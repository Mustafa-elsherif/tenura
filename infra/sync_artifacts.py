"""Copy the JSON artifacts produced by ml/train.py into the frontend's public
data folder so the live demo is fully interactive on bundled data.

Run after retraining:  python infra/sync_artifacts.py
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "ml" / "artifacts"
DST = ROOT / "frontend" / "public" / "data"
DST.mkdir(parents=True, exist_ok=True)

FILES = [
    "metrics.json",
    "feature_importance.json",
    "scored_employees.json",
    "segments.json",
    "client_model.json",
]

for name in FILES:
    shutil.copy2(SRC / name, DST / name)
    print(f"copied {name}")
print(f"-> {DST}")
