"""Portable release format shared by the dashboard, trainer, and scorer."""

import json
from pathlib import Path
from zipfile import ZipFile

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEMO_RELEASE = ROOT / "artifacts" / "demo.zip"
LOCAL_RELEASE = ROOT / ".artifacts" / "workforce-atlas.zip"
DEMO_DATA = ROOT / "data" / "WA_Fn-UseC_-HR-Employee-Attrition.csv"
DEMO_SHA256 = "a5c31e38bd7fafc9bc333884eb181b06b41b8e5e488e8f7ccb27199fb3be7659"
FORMAT_VERSION = 1
RISK_THRESHOLD = 0.6
SNAPSHOT_COLUMNS = [
    "Age", "Attrition", "Department", "Gender", "OverTime", "MonthlyIncome",
    "JobLevel", "TotalWorkingYears", "YearsAtCompany", "EngagementScore",
    "SatisfactionScore", "RiskScore", "cluster",
]


def read_metadata(archive):
    metadata = json.loads(archive.read("metadata.json"))
    if metadata.get("format_version") != FORMAT_VERSION:
        raise ValueError("Unsupported release format.")
    return metadata


def read_snapshot(path):
    with ZipFile(path) as archive:
        metadata = read_metadata(archive)
        with archive.open("snapshot.parquet") as snapshot:
            data = pd.read_parquet(snapshot, columns=SNAPSHOT_COLUMNS)
    if len(data) != metadata["records"]:
        raise ValueError("Dashboard snapshot and release metadata disagree.")
    data["Segment"] = data["cluster"].astype(str).map(metadata["segments"])
    if data["Segment"].isna().any():
        raise ValueError("Dashboard snapshot contains an unknown segment.")
    return data, metadata
