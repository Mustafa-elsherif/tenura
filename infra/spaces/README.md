---
title: Tenura API
emoji: 📊
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Tenura API on Hugging Face Spaces

This is the Space card for hosting the Tenura FastAPI backend as a Docker Space.

## Deploy
1. Create a new **Docker** Space at https://huggingface.co/new-space.
2. Push this repository's contents so that, at the Space root, `Dockerfile` is a
   copy of `infra/spaces/Dockerfile` and the `backend/` and `ml/artifacts/`
   folders are present (the build context is the repo root).

   The quickest path from this repo:
   ```bash
   cp infra/spaces/Dockerfile ./Dockerfile      # at repo root for the Space
   git add Dockerfile && git commit -m "Add Spaces Dockerfile"
   git push https://huggingface.co/spaces/<user>/tenura-api main
   ```
3. The Space builds and serves the API on port 7860. OpenAPI docs are at `/docs`.

## Point the dashboard at it
Rebuild the frontend with `VITE_API_BASE=https://<user>-tenura-api.hf.space` to
switch the dashboard from bundled demo data to the live API.
