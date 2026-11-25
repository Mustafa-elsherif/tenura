# Tenura API — production container
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ARTIFACTS_DIR=/app/artifacts \
    PORT=8000

WORKDIR /app

# System deps for xgboost (libgomp) only.
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Application code and pre-computed artifacts.
COPY backend/app ./app
COPY ml/artifacts ./artifacts

EXPOSE 8000

# Gunicorn with a uvicorn worker; artifacts load once at startup.
CMD ["sh", "-c", "gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:${PORT} --timeout 120"]
