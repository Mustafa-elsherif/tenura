# Workforce Atlas — Autonomous Build Spec

Execute these phases IN ORDER, autonomously, without stopping to ask the user
(the owner is asleep). If a step needs a credential or a click you cannot perform,
do the most it allows, record the single remaining action in DEPLOYMENT.md, and
CONTINUE to the next phase. Commit after each phase with a clean professional
message — follow CLAUDE.md attribution rules exactly (no Claude/co-author/trailer lines).

Positioning: build this as a real SaaS product a freelance client would pay for —
"Workforce Atlas: employee attrition & workforce-risk intelligence." Everything
(structure, code, UI, copy, README) should make a client feel confident and impressed.

## Phase 0 — Baseline & clean slate
- Read CLAUDE.md. Inspect the current tree. Move the reference screenshot (root PNG)
  to docs/reference/ and use it as the visual north star.
- Remove ALL legacy/unused content: old Streamlit app, notebooks, outputs, __pycache__,
  dead scripts, old dashboards. Keep .git, data/, and anything genuinely reused.
- Final structure:
  ml/        training pipeline + serialized artifacts
  backend/   FastAPI service
  frontend/  dashboard SPA
  infra/     Dockerfiles, docker-compose, deploy configs
  docs/      README assets, reference image, API notes
  .github/   CI/CD workflows

## Phase 1 — Data & model (best results, best params)
- Use the IBM HR Attrition dataset (1,470 x 35). Clean + engineer features.
- Train and compare LogisticRegression, RandomForest, and XGBoost/GradientBoosting;
  select by cross-validated ROC-AUC and PR-AUC on an honest split. Tune hyperparameters.
  You may change algorithms/features/data as needed to reach the best honest result.
- Calibrate probabilities. Compute SHAP global importances and per-employee top drivers.
- Serialize into ml/artifacts/: model.joblib, preprocessing pipeline, metrics.json,
  feature_importance.json, and scored_employees.json (every employee: id, key fields,
  risk_score, risk_band, top_drivers). These artifacts are what the app serves —
  NO training at runtime.
- ml/README.md: data, method, metrics, how to retrain.

## Phase 2 — Backend API (FastAPI)
- Endpoints: GET /health, GET /metrics, GET /employees (filter/sort/paginate),
  GET /employees/{id}, POST /predict (single record), POST /predict/batch (CSV upload),
  GET /drivers (global importance), GET /segments (risk bands, departments, roles).
- Load artifacts once at startup. Pydantic schemas, input validation, CORS for the
  frontend, structured errors. OpenAPI docs at /docs. pytest tests. Dockerfile (gunicorn+uvicorn).

## Phase 3 — Frontend dashboard (world-class)
- Invoke the frontend-design skill and the data:build-dashboard skill before building.
- Match the reference image's modern glassmorphism aesthetic, ADAPTED to workforce
  analytics (not e-commerce). One coherent design system (color, type, spacing,
  components); accessible; responsive; light/dark.
- Screens/sections:
  * KPI row: headcount, attrition rate, high-risk employees, average risk score.
  * Risk overview chart (risk by department/segment over bands).
  * Attrition drivers panel (global SHAP importances, readable).
  * Sortable/filterable high-risk employee table; click a row -> per-employee drivers
    and a plain-language explanation + suggested retention action.
  * Single-employee "what-if" predictor form that calls POST /predict.
  * Batch upload (CSV) -> scored table + downloadable results.
- Calls the backend API. For the public demo, bundle the scored dataset so the live
  site is fully interactive even before the backend is hosted. Build to static assets.
- No AI slop: real labels, real numbers, intentional layout.

## Phase 4 — Integration & tests
- docker-compose.yml runs backend + frontend together. End-to-end smoke test.
- Unit tests for ml transforms and api endpoints. Lint + format. Everything green.

## Phase 5 — Deploy (end with a LIVE url)
- Frontend -> GitHub Pages via a GitHub Actions workflow (build + actions/deploy-pages).
  If Pages is not enabled, enable it programmatically with the authenticated gh CLI
  (gh api -X POST repos/Mustafa-elsherif/workforce-atlas/pages ...). If that cannot be
  done autonomously, record the one click in DEPLOYMENT.md and continue.
- Backend -> production Dockerfile + render.yaml AND a Hugging Face Spaces (Docker) config,
  with a one-command deploy. If no host can be authenticated without the owner, record the
  single remaining step in DEPLOYMENT.md. When the backend is live, point the frontend at it;
  otherwise the frontend runs on the bundled scored data so the demo still works end to end.
- Verify the public URL loads and the dashboard is usable.

## Phase 6 — Docs & handoff
- Top-level README.md written to impress a freelance client: what it is, LIVE link,
  screenshots/GIF, architecture diagram, run-locally steps, API reference, deploy steps.
- DEPLOYMENT.md: the live URL(s) and any single manual step that remains.
- Final clean commit + push to origin/main. Then verify: no commit in the new history
  contains "Claude", "Anthropic", "Co-Authored", or a session URL.

## Hard reminders
- Never stop on a missing credential — do everything possible, log the one step, move on.
- The end user never waits for training; artifacts are pre-computed.
- Commits are the owner's, clean, professional, with zero attribution/trailer lines.
- Keep CLAUDE.md in the final repo. BUILD_SPEC.md may be removed before the final push.
