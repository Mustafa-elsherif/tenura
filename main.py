"""Train and score Workforce Atlas models offline."""

import argparse
import logging
import os
import sys
from pathlib import Path

from hr_analytics.release import DEMO_DATA, DEMO_RELEASE, LOCAL_RELEASE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command")
    train_parser = commands.add_parser("train", help="Fit and package a new release")
    train_parser.add_argument("--data", type=Path, default=DEMO_DATA)
    train_parser.add_argument("--output", type=Path, default=LOCAL_RELEASE)
    train_parser.add_argument("--reports", action="store_true", help="Include legacy Parquet and chart outputs")
    train_parser.add_argument("--reuse-original-forests", action="store_true",
                              help="Package the committed demo forests without refitting them")
    predict_parser = commands.add_parser("predict", help="Score a CSV with a saved release")
    predict_parser.add_argument("--data", type=Path, required=True)
    predict_parser.add_argument("--release", type=Path)
    predict_parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command is None:
        args = parser.parse_args(["train", "--reports"])

    os.environ.setdefault("MPLBACKEND", "Agg")
    os.environ.setdefault("PYSPARK_PYTHON", sys.executable)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    from filelock import Timeout
    from hr_analytics.data_ingestion import create_spark_session
    from hr_analytics.workflow import predict, train

    data = args.data.resolve()
    output = args.output.resolve()
    if not data.is_file():
        parser.error("The input CSV does not exist.")
    if data == output:
        parser.error("The output must differ from the input CSV.")
    if args.command == "train" and output.suffix.lower() != ".zip":
        parser.error("The release output must end in .zip.")
    if args.command == "predict":
        release = args.release or (LOCAL_RELEASE if LOCAL_RELEASE.is_file() else DEMO_RELEASE)
        if output == release.resolve():
            parser.error("The prediction output must differ from the release archive.")

    spark = None
    try:
        spark = create_spark_session()
        if args.command == "train":
            train(spark, data, output, reuse_original=args.reuse_original_forests, reports=args.reports)
        else:
            predict(spark, data, release.resolve(), output)
    except Timeout:
        logging.error("A training job is already writing to this output directory.")
        return 1
    except Exception:
        logging.exception("%s failed", args.command.capitalize())
        return 1
    finally:
        if spark is not None:
            try:
                spark.stop()
            except Exception:
                logging.debug("Spark session does not support stop()", exc_info=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
