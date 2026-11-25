# Tenura — ML training pipeline

Offline pipeline that turns the raw IBM HR Attrition dataset into the serialized
artifacts the API and dashboard serve. **Nothing here runs at request time** — the
model is trained once and the app loads the artifacts at startup.

## Data
- Source: IBM HR Employee Attrition (`data/WA_Fn-UseC_-HR-Employee-Attrition.csv`), 1,470 employees × 35 columns.
- Constant columns (`EmployeeCount`, `Over18`, `StandardHours`) are dropped; `EmployeeNumber` is kept only as an identifier.
- Eight engineered features (tenure ratio, pay-for-level, promotion stagnation, manager stability, overall satisfaction, …) are defined in `features.py` and shared verbatim with the backend so train-time and serve-time features are identical.

## Method
1. Honest stratified split — 70% train / 15% validation / 15% test.
2. Compare **Logistic Regression, Random Forest and XGBoost** by 5-fold cross-validated ROC-AUC and PR-AUC on the training set.
3. Select the best model, then **calibrate** its probabilities (isotonic, fit on the held-out validation split).
4. Evaluate once on the untouched test split.
5. Compute **SHAP** values with a tree explainer: global importances and per-employee top drivers, with one-hot dummies aggregated back to their parent feature so every driver is human-readable.
6. Band each employee: Critical ≥ 0.60, High ≥ 0.35, Moderate ≥ 0.15, else Low.

## Metrics (test split)
See `artifacts/metrics.json` for the exact numbers written at train time (selected model, leaderboard, ROC-AUC, PR-AUC, F1, precision, recall, Brier score).

## Artifacts (`ml/artifacts/`)
| File | Purpose |
|------|---------|
| `model.joblib` | Full serving pipeline (preprocess → calibrated classifier) for probabilities |
| `explainer.joblib` | Preprocessor + tree model for live SHAP drivers on `/predict` |
| `metrics.json` | Leaderboard, calibrated validation/test metrics, dataset summary |
| `feature_importance.json` | Global SHAP importances (parent features) |
| `scored_employees.json` | Every employee scored: risk score, band, top drivers |
| `segments.json` | Aggregates by department, role, band, overtime, travel |

## Retrain
```bash
pip install -r ../requirements.txt
cd ml && python train.py
```
This overwrites `ml/artifacts/`. Copy the JSON artifacts into `frontend/public/data/` to refresh the bundled live-demo data (`infra/sync_artifacts.py` does this).
