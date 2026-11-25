"""Load the serialized Tenura artifacts once at startup and expose helpers.

The API never trains or does heavy compute per request — it reads the joblib /
JSON artifacts produced by `ml/train.py` and keeps them in memory.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

from .features import ALL_FEATURES, CATEGORICAL, engineer_features, pretty_feature

# Resolve the artifacts directory: env override, container path, or repo path.
_CANDIDATES = [
    os.environ.get("ARTIFACTS_DIR"),
    "/app/artifacts",
    str(Path(__file__).resolve().parents[2] / "ml" / "artifacts"),
]
ARTIFACTS_DIR = next((Path(p) for p in _CANDIDATES if p and Path(p).exists()), None)

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


def risk_band(score: float) -> str:
    if score >= 0.60:
        return "Critical"
    if score >= 0.35:
        return "High"
    if score >= 0.15:
        return "Moderate"
    return "Low"


class Store:
    """In-memory holder for the loaded artifacts."""

    def __init__(self) -> None:
        if ARTIFACTS_DIR is None:
            raise RuntimeError("Artifacts directory not found. Run `python ml/train.py` first.")
        self.dir = ARTIFACTS_DIR
        self.model = joblib.load(self.dir / "model.joblib")
        exp = joblib.load(self.dir / "explainer.joblib")
        self.pre = exp["preprocessor"]
        self.shap_model = exp["model"]
        self.clean_names = exp["clean_names"]
        self.model_type = exp.get("model_type", "tree")
        self.background = exp.get("background")
        self.metrics = json.loads((self.dir / "metrics.json").read_text())
        self.feature_importance = json.loads((self.dir / "feature_importance.json").read_text())
        self.employees = json.loads((self.dir / "scored_employees.json").read_text())
        self.segments = json.loads((self.dir / "segments.json").read_text())
        self._by_id = {e["id"]: e for e in self.employees}

        # Lazily-built SHAP explainer and parent-feature grouping.
        self._explainer = None
        self._parents = None
        self._group_cols = None

    def employee(self, emp_id: int):
        return self._by_id.get(emp_id)

    def _ensure_explainer(self):
        if self._explainer is None:
            import shap

            if self.model_type == "linear":
                self._explainer = shap.LinearExplainer(self.shap_model, self.background)
            else:
                self._explainer = shap.TreeExplainer(self.shap_model)

            def parent_of(name: str) -> str:
                for col in CATEGORICAL:
                    if name.startswith(f"{col}_"):
                        return col
                return name

            self._parents = [parent_of(n) for n in self.clean_names]
            uniq = list(dict.fromkeys(self._parents))
            self._group_cols = {
                p: [i for i, pp in enumerate(self._parents) if pp == p] for p in uniq
            }

    def predict(self, record: dict) -> dict:
        """Score a single raw employee record and return risk + drivers."""
        self._ensure_explainer()
        df = pd.DataFrame([record])
        df = engineer_features(df)
        X = df[ALL_FEATURES]
        score = float(self.model.predict_proba(X)[:, 1][0])

        Xt = self.pre.transform(X)
        sv = self._explainer.shap_values(Xt)
        if isinstance(sv, list):  # [cls0, cls1]
            sv = sv[-1]
        sv = np.asarray(sv)
        if sv.ndim == 3:  # (n, features, classes)
            sv = sv[:, :, -1]
        contribs = sv[0]
        grouped = {p: float(contribs[cols].sum()) for p, cols in self._group_cols.items()}
        top = sorted(grouped, key=lambda p: abs(grouped[p]), reverse=True)[:5]
        drivers = []
        for p in top:
            val = grouped[p]
            if abs(val) < 1e-6:
                continue
            label = f"{pretty_feature(p)}: {record[p]}" if p in CATEGORICAL else pretty_feature(p)
            drivers.append(
                {
                    "feature": p,
                    "label": label,
                    "impact": round(val, 4),
                    "direction": "increases" if val > 0 else "reduces",
                    "action": RETENTION_ACTIONS.get(p) if val > 0 else None,
                }
            )
        return {"risk_score": round(score, 4), "risk_band": risk_band(score), "top_drivers": drivers}


@lru_cache(maxsize=1)
def get_store() -> Store:
    return Store()
