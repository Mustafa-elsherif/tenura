# Hugging Face Spaces (Docker) entrypoint for the Tenura API.
# Spaces serve on port 7860. Build context must be the REPO ROOT.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 ARTIFACTS_DIR=/app/artifacts PORT=7860

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY ml/artifacts ./artifacts

EXPOSE 7860
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:${PORT} --timeout 120"]
