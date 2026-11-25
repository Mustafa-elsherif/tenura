# Deployment

## Live URLs
- **Dashboard (public):** https://mustafa-elsherif.github.io/tenura/
- **Repository:** https://github.com/Mustafa-elsherif/tenura

The dashboard is a static build deployed to GitHub Pages by
`.github/workflows/deploy-pages.yml` on every push to `main`. Pages is enabled with
the **GitHub Actions** build type (configured via the API during setup), so no manual
Pages setup is required — the first push builds and publishes the site. The public
site runs on the **bundled scored dataset** and a faithful **in-browser copy of the
trained model**, so it is fully interactive (overview, employee register, what-if
predictor, batch scoring) with no backend needed.

## Backend hosting — one remaining manual step
The backend is fully containerised and deploy-ready, but publishing it to a host
requires the repository owner's login to that host (no host could be authenticated
non-interactively during this build). Pick either option; both are one action:

### Option A — Render (recommended)
1. Sign in at https://render.com with the GitHub account.
2. **New + → Blueprint**, select the `tenura` repo. Render reads `render.yaml` and
   builds `backend/Dockerfile`.
3. Deploy. The API comes up at `https://tenura-api.onrender.com` (health: `/health`,
   docs: `/docs`).

### Option B — Hugging Face Spaces (Docker)
Follow `infra/spaces/README.md` (copy `infra/spaces/Dockerfile` to the Space root and
push). The API serves on port 7860.

### Point the dashboard at the live backend (optional)
Once the API is hosted, rebuild the dashboard with the API base set so it uses live
calls instead of bundled data:
```bash
# GitHub Actions: add repository variable VITE_API_BASE = https://<your-api-host>
# or locally:
cd frontend && VITE_API_BASE=https://tenura-api.onrender.com npm run build
```
Until then the dashboard runs on bundled data and is fully usable — nothing is blocked.

## Local full stack
```bash
docker compose up --build
# Dashboard → http://localhost:8080   API docs → http://localhost:8000/docs
```

## Verification notes
- Backend container image builds successfully from `backend/Dockerfile` and the API
  passes its test suite (`cd backend && pytest`); the app also runs directly under
  `uvicorn` / `gunicorn`.
- The in-browser model was verified to match the served model within 1e-4 across
  sampled employees.
