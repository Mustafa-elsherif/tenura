"""Tenura — offline training pipeline.

Trains and compares Logistic Regression, Random Forest and XGBoost on the IBM HR
Attrition dataset, selects the best model by cross-validated ROC-AUC, calibrates
its probabilities, computes SHAP global + per-employee drivers, and serializes
everything into ``ml/artifacts/`` so the API and dashboard never train at runtime.

Run:  python ml/train.py
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
import shap
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.frozen import FrozenEstimator
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

from features import (
    ALL_FEATURES,
    CATEGORICAL,
    ID_COLUMN,
    NUMERIC_FEATURES,
    TARGET_COLUMN,
    engineer_features,
    pretty_feature,
)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "WA_Fn-UseC_-HR-Employee-Attrition.csv"
ARTIFACTS = ROOT / "ml" / "artifacts"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

RANDOM_STATE = 42


def build_preprocessor() -> ColumnTransformer:
    numeric = Pipeline(
        [("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]
    )
    categorical = Pipeline(
        [
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    return ColumnTransformer(
        [("num", numeric, NUMERIC_FEATURES), ("cat", categorical, CATEGORICAL)],
        remainder="drop",
    )


def candidate_models(scale_pos_weight: float) -> dict:
    return {
        "Logistic Regression": LogisticRegression(
            max_iter=2000, class_weight="balanced", C=0.5, random_state=RANDOM_STATE
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=600, max_depth=8, min_samples_leaf=4,
            class_weight="balanced_subsample", random_state=RANDOM_STATE, n_jobs=-1,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=450, max_depth=4, learning_rate=0.03, subsample=0.85,
            colsample_bytree=0.8, min_child_weight=2, reg_lambda=1.5, reg_alpha=0.2,
            scale_pos_weight=scale_pos_weight, eval_metric="logloss",
            random_state=RANDOM_STATE, n_jobs=-1,
        ),
    }


RETENTION_ACTIONS = {
    "OverTime": "Rebalance workload or formalise overtime pay; sustained overtime is a top attrition driver.",
    "MonthlyIncome": "Benchmark compensation against market; this employee may be underpaid for their level.",
    "IncomePerLevel": "Review pay equity for the job level — compensation looks low for the responsibility.",
    "IncomePerYearWorked": "Check that pay has kept pace with accumulated experience.",
    "StockOptionLevel": "Consider adding or increasing equity to strengthen long-term commitment.",
    "YearsSinceLastPromotion": "Open a career-progression conversation; promotion has stalled.",
    "PromotionStagnation": "Build a concrete promotion or growth plan — advancement has stagnated.",
    "JobSatisfaction": "Run a stay interview to surface and fix satisfaction blockers.",
    "EnvironmentSatisfaction": "Address workplace-environment concerns raised in engagement surveys.",
    "SatisfactionIndex": "Overall satisfaction is low — prioritise a manager-led stay interview.",
    "WorkLifeBalance": "Offer flexibility or workload relief to improve work-life balance.",
    "JobInvolvement": "Increase ownership and meaningful work to lift engagement.",
    "DistanceFromHome": "Explore hybrid or remote options to ease a long commute.",
    "Age": "Tailor retention to career stage with targeted development or mentoring.",
    "TotalWorkingYears": "Match growth opportunities to the employee's experience level.",
    "YearsAtCompany": "Recognise tenure and re-energise with a fresh challenge or lateral move.",
    "YearsWithCurrManager": "Assess the manager relationship; low manager tenure can raise flight risk.",
    "ManagerStability": "Stabilise reporting lines — frequent manager changes erode retention.",
    "BusinessTravel": "Reduce or better support travel load where it is driving fatigue.",
    "NumCompaniesWorked": "Reinforce belonging and growth path for a historically mobile hire.",
    "JobRole": "Review role-specific retention risks and career ladders.",
    "MaritalStatus": "Ensure benefits and flexibility fit the employee's life stage.",
}


def action_for(feature: str) -> str:
    base = feature.split(":")[0].strip()
    for key, text in RETENTION_ACTIONS.items():
        if pretty_feature(key) == base or key == base:
            return text
    return "Schedule a manager check-in to understand and address this risk factor."


def _to_positive_class(shap_values):
    """Normalise SHAP output to a 2-D (n_samples, n_features) array for the
    positive class, whatever the model/explainer flavour returns."""
    if isinstance(shap_values, list):  # tree classifiers may return [cls0, cls1]
        return np.asarray(shap_values[-1])
    arr = np.asarray(shap_values)
    if arr.ndim == 3:  # (n, features, classes)
        return arr[:, :, -1]
    return arr


def risk_band(score: float) -> str:
    if score >= 0.60:
        return "Critical"
    if score >= 0.35:
        return "High"
    if score >= 0.15:
        return "Moderate"
    return "Low"


def main() -> None:
    t0 = time.time()
    print(f"Loading {DATA.name} ...")
    df = pd.read_csv(DATA)
    df = engineer_features(df)

    y = (df[TARGET_COLUMN] == "Yes").astype(int)
    X = df[ALL_FEATURES].copy()

    # Honest split: 70 train / 15 val / 15 test, stratified.
    X_trainval, X_test, y_trainval, y_test, idx_trainval, idx_test = train_test_split(
        X, y, df.index, test_size=0.15, stratify=y, random_state=RANDOM_STATE
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval, test_size=0.1765, stratify=y_trainval, random_state=RANDOM_STATE
    )
    print(f"Split -> train {len(X_train)}  val {len(X_val)}  test {len(X_test)}")

    pos_weight = float((y_train == 0).sum() / max((y_train == 1).sum(), 1))
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    # Compare candidates by cross-validated ROC-AUC on the training set.
    leaderboard = []
    fitted = {}
    for name, clf in candidate_models(pos_weight).items():
        pipe = Pipeline([("pre", build_preprocessor()), ("clf", clf)])
        auc = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
        ap = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="average_precision", n_jobs=-1)
        pipe.fit(X_train, y_train)
        fitted[name] = pipe
        leaderboard.append(
            {
                "model": name,
                "cv_roc_auc": round(float(auc.mean()), 4),
                "cv_roc_auc_std": round(float(auc.std()), 4),
                "cv_pr_auc": round(float(ap.mean()), 4),
            }
        )
        print(f"  {name:20s} CV ROC-AUC={auc.mean():.4f}  PR-AUC={ap.mean():.4f}")

    leaderboard.sort(key=lambda r: r["cv_roc_auc"], reverse=True)
    best_name = leaderboard[0]["model"]
    print(f"Best model: {best_name}")

    # Calibrate the best model's probabilities (isotonic on the validation set).
    best_estimator = candidate_models(pos_weight)[best_name]
    pre = build_preprocessor().fit(X_train, y_train)
    X_train_t = pre.transform(X_train)
    X_val_t = pre.transform(X_val)
    X_test_t = pre.transform(X_test)

    base = best_estimator.fit(X_train_t, y_train)
    calibrated = CalibratedClassifierCV(FrozenEstimator(base), method="isotonic")
    calibrated.fit(X_val_t, y_val)

    # Final serving pipeline: preprocessor -> calibrated classifier.
    serving = Pipeline([("pre", pre), ("clf", calibrated)])

    def evaluate(split_name, Xs, ys):
        proba = serving.predict_proba(Xs)[:, 1]
        pred = (proba >= 0.5).astype(int)
        return {
            "split": split_name,
            "n": int(len(ys)),
            "roc_auc": round(float(roc_auc_score(ys, proba)), 4),
            "pr_auc": round(float(average_precision_score(ys, proba)), 4),
            "f1": round(float(f1_score(ys, pred)), 4),
            "precision": round(float(precision_score(ys, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(ys, pred)), 4),
            "brier": round(float(brier_score_loss(ys, proba)), 4),
        }

    metrics_val = evaluate("validation", X_val, y_val)
    metrics_test = evaluate("test", X_test, y_test)
    print(f"  Test ROC-AUC={metrics_test['roc_auc']}  PR-AUC={metrics_test['pr_auc']}  "
          f"Recall={metrics_test['recall']}")

    # SHAP explains the SAME algorithm that is served, refit on train+val so
    # drivers and the (monotonically) calibrated risk score stay consistent.
    shap_model = candidate_models(pos_weight)[best_name]
    shap_pre = build_preprocessor().fit(X_trainval, y_trainval)
    X_tv_t = shap_pre.transform(X_trainval)
    shap_model.fit(X_tv_t, y_trainval)
    feature_names = list(shap_pre.get_feature_names_out())
    clean_names = [n.split("__", 1)[-1] for n in feature_names]

    is_tree = best_name in ("Random Forest", "XGBoost")
    if is_tree:
        explainer = shap.TreeExplainer(shap_model)
    else:
        # Linear model: background = a sample of the transformed training data.
        bg = shap.sample(X_tv_t, 200, random_state=RANDOM_STATE)
        explainer = shap.LinearExplainer(shap_model, bg)
    model_type = "tree" if is_tree else "linear"

    # Map each encoded column to its parent feature so one-hot dummies are
    # aggregated back into a single, readable driver (e.g. "Business travel").
    def parent_of(name: str) -> str:
        for col in CATEGORICAL:
            if name.startswith(f"{col}_"):
                return col
        return name

    parents = [parent_of(n) for n in clean_names]
    unique_parents = list(dict.fromkeys(parents))  # preserves order
    group_cols = {p: [i for i, pp in enumerate(parents) if pp == p] for p in unique_parents}

    # Global importance = mean |summed SHAP per parent feature| over the dataset.
    X_all_t = shap_pre.transform(X)
    shap_all = _to_positive_class(explainer.shap_values(X_all_t))
    grouped_abs = {p: np.abs(shap_all[:, cols].sum(axis=1)).mean() for p, cols in group_cols.items()}
    order = sorted(grouped_abs, key=grouped_abs.get, reverse=True)
    feature_importance = [
        {"feature": p, "label": pretty_feature(p), "importance": round(float(grouped_abs[p]), 5)}
        for p in order
        if grouped_abs[p] > 0
    ][:18]

    # Score every employee + per-employee top drivers.
    proba_all = serving.predict_proba(X)[:, 1]
    scored = []
    for pos, idx in enumerate(df.index):
        row = df.loc[idx]
        contribs = shap_all[pos]
        # Aggregate SHAP to parent features for clean, correct drivers.
        grouped = {p: float(contribs[cols].sum()) for p, cols in group_cols.items()}
        top = sorted(grouped, key=lambda p: abs(grouped[p]), reverse=True)[:4]
        drivers = []
        for p in top:
            val = grouped[p]
            if abs(val) < 1e-6:
                continue
            if p in CATEGORICAL:
                label = f"{pretty_feature(p)}: {row[p]}"
            else:
                label = pretty_feature(p)
            direction = "increases" if val > 0 else "reduces"
            drivers.append(
                {
                    "feature": p,
                    "label": label,
                    "impact": round(val, 4),
                    "direction": direction,
                    "action": action_for(p) if val > 0 else None,
                }
            )
        score = float(proba_all[pos])
        scored.append(
            {
                "id": int(row[ID_COLUMN]),
                "age": int(row["Age"]),
                "department": row["Department"],
                "job_role": row["JobRole"],
                "job_level": int(row["JobLevel"]),
                "monthly_income": int(row["MonthlyIncome"]),
                "years_at_company": int(row["YearsAtCompany"]),
                "overtime": row["OverTime"],
                "business_travel": row["BusinessTravel"],
                "gender": row["Gender"],
                "marital_status": row["MaritalStatus"],
                "job_satisfaction": int(row["JobSatisfaction"]),
                "work_life_balance": int(row["WorkLifeBalance"]),
                "years_since_promotion": int(row["YearsSinceLastPromotion"]),
                "attrition_actual": row[TARGET_COLUMN],
                "risk_score": round(score, 4),
                "risk_band": risk_band(score),
                "top_drivers": drivers,
            }
        )

    # Aggregate segments.
    sdf = pd.DataFrame(scored)
    def seg(col):
        g = sdf.groupby(col).agg(
            headcount=("id", "count"),
            avg_risk=("risk_score", "mean"),
            high_risk=("risk_band", lambda s: int(s.isin(["High", "Critical"]).sum())),
            actual_attrition=("attrition_actual", lambda s: round(float((s == "Yes").mean()), 4)),
        ).reset_index()
        return [
            {
                "name": str(r[col]),
                "headcount": int(r["headcount"]),
                "avg_risk": round(float(r["avg_risk"]), 4),
                "high_risk": int(r["high_risk"]),
                "actual_attrition": float(r["actual_attrition"]),
            }
            for _, r in g.iterrows()
        ]

    bands = ["Critical", "High", "Moderate", "Low"]
    segments = {
        "by_department": sorted(seg("department"), key=lambda r: r["avg_risk"], reverse=True),
        "by_job_role": sorted(seg("job_role"), key=lambda r: r["avg_risk"], reverse=True),
        "by_band": [
            {"name": b, "headcount": int((sdf["risk_band"] == b).sum())} for b in bands
        ],
        "by_overtime": seg("overtime"),
        "by_business_travel": seg("business_travel"),
    }

    overview = {
        "headcount": int(len(sdf)),
        "attrition_rate": round(float((sdf["attrition_actual"] == "Yes").mean()), 4),
        "high_risk_count": int(sdf["risk_band"].isin(["High", "Critical"]).sum()),
        "critical_count": int((sdf["risk_band"] == "Critical").sum()),
        "avg_risk_score": round(float(sdf["risk_score"].mean()), 4),
    }

    metrics = {
        "product": "Tenura",
        "dataset": {
            "name": "IBM HR Employee Attrition",
            "rows": int(len(df)),
            "features": len(ALL_FEATURES),
            "positive_rate": round(float(y.mean()), 4),
        },
        "selected_model": best_name,
        "leaderboard": leaderboard,
        "validation": metrics_val,
        "test": metrics_test,
        "calibration": "isotonic (prefit on validation split)",
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overview": overview,
    }

    # Serialize artifacts.
    joblib.dump(serving, ARTIFACTS / "model.joblib")
    explainer_bundle = {
        "preprocessor": shap_pre,
        "model": shap_model,
        "clean_names": clean_names,
        "model_type": model_type,
    }
    if model_type == "linear":
        explainer_bundle["background"] = shap.sample(X_tv_t, 200, random_state=RANDOM_STATE)
    joblib.dump(explainer_bundle, ARTIFACTS / "explainer.joblib")
    (ARTIFACTS / "metrics.json").write_text(json.dumps(metrics, indent=2))
    (ARTIFACTS / "feature_importance.json").write_text(json.dumps(feature_importance, indent=2))
    (ARTIFACTS / "scored_employees.json").write_text(json.dumps(scored))
    (ARTIFACTS / "segments.json").write_text(json.dumps(segments, indent=2))

    print(f"Artifacts written to {ARTIFACTS} in {time.time() - t0:.1f}s")
    print(json.dumps(overview, indent=2))


if __name__ == "__main__":
    main()
