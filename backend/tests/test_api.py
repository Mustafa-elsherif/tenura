"""API tests for the Tenura backend."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["employees"] == 1470


def test_metrics_shape():
    r = client.get("/metrics")
    assert r.status_code == 200
    m = r.json()
    assert m["selected_model"]
    assert 0.5 < m["test"]["roc_auc"] <= 1.0
    assert m["overview"]["headcount"] == 1470


def test_drivers():
    r = client.get("/drivers")
    assert r.status_code == 200
    imp = r.json()["global_importance"]
    assert len(imp) > 5
    assert imp[0]["importance"] >= imp[-1]["importance"]


def test_segments():
    r = client.get("/segments")
    assert r.status_code == 200
    seg = r.json()
    assert seg["by_department"]
    assert seg["by_band"]


def test_employees_filter_sort_paginate():
    r = client.get("/employees", params={"risk_band": "Critical,High", "limit": 10})
    assert r.status_code == 200
    body = r.json()
    assert body["limit"] == 10
    assert len(body["items"]) <= 10
    scores = [i["risk_score"] for i in body["items"]]
    assert scores == sorted(scores, reverse=True)
    for item in body["items"]:
        assert item["risk_band"] in {"Critical", "High"}


def test_employee_detail_and_404():
    r = client.get("/employees/1")
    assert r.status_code == 200
    assert r.json()["id"] == 1
    assert client.get("/employees/999999").status_code == 404


def test_predict_high_risk():
    payload = {
        "OverTime": "Yes", "MonthlyIncome": 2000, "JobSatisfaction": 1,
        "WorkLifeBalance": 1, "Age": 24, "YearsSinceLastPromotion": 6,
        "StockOptionLevel": 0, "MaritalStatus": "Single",
    }
    r = client.post("/predict", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["risk_score"] <= 1.0
    assert body["risk_band"] in {"Low", "Moderate", "High", "Critical"}
    assert len(body["top_drivers"]) >= 1


def test_predict_validation_error():
    r = client.post("/predict", json={"Age": 5})
    assert r.status_code == 422


def test_predict_batch(tmp_path):
    import pandas as pd
    df = pd.read_csv("../data/WA_Fn-UseC_-HR-Employee-Attrition.csv").head(20)
    csv_bytes = df.to_csv(index=False).encode()
    r = client.post("/predict/batch", files={"file": ("sample.csv", csv_bytes, "text/csv")})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 20
    assert all(0.0 <= x["risk_score"] <= 1.0 for x in body["results"])
