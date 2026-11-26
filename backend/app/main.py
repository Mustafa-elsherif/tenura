"""Tenura API — FastAPI service over the pre-computed workforce-risk artifacts."""
from __future__ import annotations

import io
import os
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Load .env (GEMINI_API_KEY etc.) — never committed; key stays server-side.
load_dotenv()

from .artifacts import get_store, risk_band
from .chat import chat as run_chat
from .features import ALL_FEATURES, engineer_features
from .schemas import ChatRequest, EmployeeInput, PredictResponse

app = FastAPI(
    title="Tenura API",
    version="1.0.0",
    description=(
        "Workforce-risk intelligence API. Serves pre-computed employee attrition "
        "risk scores, SHAP drivers and live what-if predictions from artifacts "
        "trained offline — no training or heavy compute happens per request."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SORT_FIELDS = {
    "risk_score", "monthly_income", "age", "years_at_company",
    "years_since_promotion", "job_level",
}


@app.get("/health", tags=["system"])
def health():
    store = get_store()
    return {
        "status": "ok",
        "model": store.metrics["selected_model"],
        "employees": len(store.employees),
        "assistant": "gemini" if os.environ.get("GEMINI_API_KEY", "").strip() else "local",
    }


@app.get("/metrics", tags=["model"])
def metrics():
    return get_store().metrics


@app.get("/drivers", tags=["model"])
def drivers():
    return {"global_importance": get_store().feature_importance}


@app.get("/segments", tags=["analytics"])
def segments():
    return get_store().segments


@app.get("/employees", tags=["employees"])
def employees(
    department: Optional[str] = None,
    job_role: Optional[str] = None,
    risk_band: Optional[str] = Query(None, alias="risk_band"),
    overtime: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "risk_score",
    order: str = "desc",
    limit: int = Query(25, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    rows = get_store().employees
    if department:
        rows = [r for r in rows if r["department"] == department]
    if job_role:
        rows = [r for r in rows if r["job_role"] == job_role]
    if risk_band:
        bands = {b.strip() for b in risk_band.split(",")}
        rows = [r for r in rows if r["risk_band"] in bands]
    if overtime:
        rows = [r for r in rows if r["overtime"] == overtime]
    if search:
        s = search.strip()
        if s.isdigit():
            rows = [r for r in rows if str(r["id"]).startswith(s)]
        else:
            sl = s.lower()
            rows = [r for r in rows if sl in r["job_role"].lower() or sl in r["department"].lower()]

    if sort_by not in SORT_FIELDS:
        sort_by = "risk_score"
    rows = sorted(rows, key=lambda r: r[sort_by], reverse=(order != "asc"))

    total = len(rows)
    page = rows[offset : offset + limit]
    return {"total": total, "limit": limit, "offset": offset, "items": page}


@app.get("/employees/{emp_id}", tags=["employees"])
def employee(emp_id: int):
    emp = get_store().employee(emp_id)
    if emp is None:
        raise HTTPException(status_code=404, detail=f"Employee {emp_id} not found")
    return emp


@app.post("/predict", response_model=PredictResponse, tags=["predict"])
def predict(record: EmployeeInput):
    return get_store().predict(record.to_record())


@app.post("/predict/batch", tags=["predict"])
async def predict_batch(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc

    store = get_store()
    try:
        eng = engineer_features(df)
        X = eng[ALL_FEATURES]
    except KeyError as exc:
        missing = str(exc).strip("'")
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing a required column: {missing}",
        ) from exc

    proba = store.model.predict_proba(X)[:, 1]
    results = []
    id_col = "EmployeeNumber" if "EmployeeNumber" in df.columns else None
    for i, score in enumerate(proba):
        score = float(score)
        results.append(
            {
                "row": int(i),
                "id": int(df[id_col].iloc[i]) if id_col else int(i + 1),
                "risk_score": round(score, 4),
                "risk_band": risk_band(score),
            }
        )
    results.sort(key=lambda r: r["risk_score"], reverse=True)
    return {"count": len(results), "results": results}


@app.post("/chat", tags=["assistant"])
async def chat(req: ChatRequest):
    history = [{"role": t.role, "content": t.content} for t in req.history]
    return await run_chat(req.message, req.lang, history, get_store())


@app.get("/", include_in_schema=False)
def root():
    return {"product": "Tenura", "docs": "/docs", "health": "/health"}
