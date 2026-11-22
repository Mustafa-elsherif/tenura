"""Build a static demo from the same Streamlit entry point."""

import argparse
import shutil
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from hr_analytics.release import DEMO_RELEASE, ROOT, read_snapshot

PUBLIC_FILES = {
    "deployment/index.html": "index.html",
    "deployment/load.js": "load.js",
    "src/dashboard.py": "src/dashboard.py",
    "src/dashboard.css": "src/dashboard.css",
    "hr_analytics/__init__.py": "hr_analytics/__init__.py",
    "hr_analytics/release.py": "hr_analytics/release.py",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    output = parser.parse_args().output
    output.mkdir(parents=True, exist_ok=True)
    for source, target in PUBLIC_FILES.items():
        destination = output / target
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, destination)
    snapshot = output / "artifacts" / "demo.zip"
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(DEMO_RELEASE) as archive, ZipFile(snapshot, "w", compression=ZIP_DEFLATED) as public:
        for member in ("metadata.json", "snapshot.parquet"):
            public.writestr(member, archive.read(member))
    read_snapshot(snapshot)


if __name__ == "__main__":
    main()
