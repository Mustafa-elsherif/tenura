"""Explicit Spark training and inference for Workforce Atlas releases."""

import json
import os
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from filelock import FileLock
from pyspark.ml import PipelineModel
from pyspark.ml.classification import RandomForestClassificationModel
from pyspark.ml.feature import StringIndexerModel, VectorAssembler
from pyspark.ml.functions import vector_to_array
from pyspark.ml.regression import RandomForestRegressionModel
from pyspark.sql import functions as F

from hr_analytics.clustering import (
    clustering_preprocessing, evaluate_clustering, find_optimal_clusters,
    plot_cluster_visualization, train_kmeans,
)
from hr_analytics.data_ingestion import load_data, save_as_parquet
from hr_analytics.eda import run_eda
from hr_analytics.feature_engineering import DERIVED_CATEGORIES, add_features
from hr_analytics.insights import generate_insights
from hr_analytics.models import (
    FEATURE_COLS, PERFORMANCE_FEATURES, evaluate_attrition_model,
    evaluate_performance_model, plot_feature_importance, prepare_features,
    train_attrition_model, train_performance_model,
)
from hr_analytics.preprocessing import CATEGORICAL_COLS, IRRELEVANT_COLS, categorical_pipeline
from hr_analytics.release import (
    DEMO_SHA256, FORMAT_VERSION, ROOT, SNAPSHOT_COLUMNS, csv_digest, read_metadata, read_snapshot,
)

RAW_INPUTS = [col for col in CATEGORICAL_COLS if col != "Attrition"]
NUMERIC_INPUTS = [
    col for col in FEATURE_COLS
    if not col.endswith("_encoded") and col not in {"EngagementScore", "SatisfactionScore", "RiskScore"}
]
SEGMENT_NAMES = ["Young High-Risk", "Mid-Career Stable", "Senior High-Income"]


def binary_indexer(column):
    # Preserve the original No=0, Yes=1 convention regardless of corpus frequencies.
    return StringIndexerModel.from_labels(
        ["No", "Yes"], inputCol=column, outputCol=f"{column}_encoded", handleInvalid="error",
    )


def validate_input(data, *, training):
    required = RAW_INPUTS + NUMERIC_INPUTS + (["Attrition"] if training else [])
    missing = sorted(set(required) - set(data.columns))
    if missing:
        raise ValueError(f"Missing input columns: {', '.join(missing)}.")
    invalid_number = F.greatest(*[
        (~F.col(col).cast("double").eqNullSafe(F.col(col).cast("int").cast("double"))).cast("int")
        for col in NUMERIC_INPUTS
    ]) > 0
    if data.filter(invalid_number).limit(1).count():
        raise ValueError("Numeric feature columns must contain whole numbers.")
    data = data.select(
        *[F.col(col).cast("int").alias(col) if col in NUMERIC_INPUTS else F.col(col)
          for col in data.columns if col in required or col in IRRELEVANT_COLS]
    )
    invalid = F.greatest(*[F.col(col).isNull().cast("int") for col in required]) > 0
    invalid |= ~F.col("OverTime").isin("No", "Yes")
    if training:
        invalid |= ~F.col("Attrition").isin("No", "Yes")
    if data.filter(invalid).limit(1).count():
        raise ValueError("Input contains missing or invalid numeric values, Attrition, or OverTime.")
    return data


def fit_features(raw):
    categorical = categorical_pipeline([col for col in RAW_INPUTS if col != "OverTime"]).fit(raw)
    by_input = {stage.getInputCol(): stage for stage in categorical.stages}
    by_input["OverTime"] = binary_indexer("OverTime")
    raw_encoder = PipelineModel([by_input[col] for col in RAW_INPUTS])
    labeled = binary_indexer("Attrition").transform(raw)
    preprocessed = raw_encoder.transform(labeled)
    enriched = add_features(preprocessed)
    derived_encoder = categorical_pipeline(DERIVED_CATEGORIES).fit(enriched)
    return raw_encoder, derived_encoder, preprocessed, derived_encoder.transform(enriched)


def regression_features(data):
    return VectorAssembler(
        inputCols=PERFORMANCE_FEATURES, outputCol="features_reg",
    ).transform(data)


def fit_or_reuse_forests(engineered, reuse_original):
    print("2/5  Evaluating attrition and performance forests", flush=True)
    classification_data = prepare_features(engineered)
    if reuse_original:
        original = ROOT / "models"
        classifier = RandomForestClassificationModel.load((original / "attrition_model").as_uri())
        regressor = RandomForestRegressionModel.load((original / "performance_model").as_uri())
        _, classification_test = classification_data.randomSplit([0.8, 0.2], seed=42)
        _, regression_test = regression_features(engineered).randomSplit([0.8, 0.2], seed=42)
        attrition_predictions = classifier.transform(classification_test)
        performance_predictions = regressor.transform(regression_test)
    else:
        classifier, attrition_predictions, _ = train_attrition_model(classification_data)
        regressor, performance_predictions = train_performance_model(engineered)

    confusion = [
        {"actual": int(row.Attrition_encoded), "predicted": int(row.prediction), "count": row["count"]}
        for row in attrition_predictions.groupBy("Attrition_encoded", "prediction").count().collect()
    ]
    return classifier, regressor, {
        "attrition": evaluate_attrition_model(attrition_predictions),
        "performance": evaluate_performance_model(performance_predictions),
        "attrition_test_records": sum(row["count"] for row in confusion),
        "performance_test_records": performance_predictions.count(),
        "confusion": sorted(confusion, key=lambda row: (row["actual"], row["predicted"])),
        "importance": [
            {"feature": col, "importance": float(value)}
            for col, value in zip(FEATURE_COLS, classifier.featureImportances.toArray(), strict=True)
        ],
    }


def score(engineered, pipeline):
    return pipeline.transform(engineered).withColumn(
        "AttritionVoteShare", vector_to_array("AttritionVotes")[1],
    ).withColumn(
        "PredictedAttrition", F.when(F.col("AttritionClass") == 1, "Yes").otherwise("No"),
    )


def build_release(spark, source, directory, reuse_original, reports):
    fingerprint = csv_digest(source)
    if reuse_original and fingerprint != DEMO_SHA256:
        raise ValueError("The original forests can only be packaged using the original IBM demo CSV.")
    print("1/5  Reading and preparing the training data", flush=True)
    raw = validate_input(load_data(spark, source.as_uri()), training=True).distinct().coalesce(1).cache()
    if raw.select("Attrition").distinct().count() != 2:
        raise ValueError("Training requires both Yes and No attrition labels.")
    raw_encoder, derived_encoder, preprocessed, enriched = fit_features(raw)
    # Keep the original model input schema and column order for the seeded split.
    encoded_order = [f"{col}_encoded" for col in CATEGORICAL_COLS]
    modeled = enriched.select(
        *[col for col in raw.columns if col not in IRRELEVANT_COLS + CATEGORICAL_COLS],
        *encoded_order, "EngagementScore", "SatisfactionScore", "RiskScore",
        *[f"{col}_encoded" for col in DERIVED_CATEGORIES],
    ).cache()
    if reuse_original:
        # Replay the historical model evaluation on the exact committed feature table.
        baseline = spark.read.parquet((ROOT / "data" / "hr_data_engineered.parquet").as_uri())
        if modeled.exceptAll(baseline.select(*modeled.columns)).limit(1).count() or (
            baseline.select(*modeled.columns).exceptAll(modeled).limit(1).count()
        ):
            raise ValueError("Regenerated features do not match the original model inputs.")
        modeled = baseline
    classifier, regressor, metrics = fit_or_reuse_forests(modeled, reuse_original)

    print("3/5  Fitting the segmentation model", flush=True)
    scaler = clustering_preprocessing().fit(modeled)
    scaled = scaler.transform(modeled)
    kmeans, clusters = train_kmeans(scaled)
    metrics["silhouette"] = evaluate_clustering(clusters)
    cluster_order = clusters.groupBy("cluster").avg("MonthlyIncome").orderBy("avg(MonthlyIncome)").collect()
    segments = {str(row.cluster): name for row, name in zip(cluster_order, SEGMENT_NAMES, strict=True)}

    # Evaluate before renaming inference outputs so the existing evaluators keep their columns.
    classifier.setPredictionCol("AttritionClass").setProbabilityCol("AttritionVotes")
    regressor.setPredictionCol("PredictedPerformance")
    predictor = PipelineModel([
        VectorAssembler(inputCols=FEATURE_COLS, outputCol="features"),
        VectorAssembler(inputCols=PERFORMANCE_FEATURES, outputCol="features_reg"),
        classifier, regressor, *scaler.stages, kmeans,
    ])
    print("4/5  Saving fitted encoders, models, and dashboard snapshot", flush=True)
    for name, model in (("raw_encoder", raw_encoder), ("derived_encoder", derived_encoder),
                        ("predictor", predictor)):
        model.write().save((directory / name).as_uri())
    snapshot = score(enriched, predictor).select(*SNAPSHOT_COLUMNS).orderBy(
        "Department", "Age", "MonthlyIncome", "RiskScore", "EngagementScore", "SatisfactionScore",
    ).toPandas()
    snapshot.to_parquet(directory / "snapshot.parquet", index=False)
    metadata = {
        "format_version": FORMAT_VERSION, "records": len(snapshot), "source_sha256": fingerprint,
        "spark_version": spark.version, "segments": segments, "metrics": metrics,
        "forest_source": "original" if reuse_original else "trained",
    }
    (directory / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    if reports:
        print("5/5  Generating Parquet data, charts, and analysis reports", flush=True)
        old_directory = Path.cwd()
        try:
            os.chdir(directory)
            Path("outputs").mkdir()
            Path("data").mkdir()
            preprocessed = preprocessed.drop(*(IRRELEVANT_COLS + CATEGORICAL_COLS))
            save_as_parquet(raw, (directory / "data/hr_data.parquet").as_uri())
            save_as_parquet(preprocessed, (directory / "data/hr_data_preprocessed.parquet").as_uri())
            save_as_parquet(modeled, (directory / "data/hr_data_engineered.parquet").as_uri())
            run_eda(preprocessed, raw)
            plot_feature_importance(classifier, FEATURE_COLS)
            find_optimal_clusters(scaled)
            plot_cluster_visualization(clusters, segments)
            generate_insights(modeled, clusters, segments)
        finally:
            os.chdir(old_directory)
    else:
        print("5/5  Validating the packaged release", flush=True)


def train(spark, source, output, *, reuse_original=False, reports=False):
    output.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(output.parent / ".training.lock"), timeout=0):
        with tempfile.TemporaryDirectory(prefix="training-", dir=output.parent) as temporary:
            work = Path(temporary)
            payload = work / "payload"
            payload.mkdir()
            build_release(spark, source, payload, reuse_original, reports)
            bundle = work / "release.zip"
            with ZipFile(bundle, "w", compression=ZIP_DEFLATED) as archive:
                for file in sorted(payload.rglob("*")):
                    if file.is_file() and file.suffix != ".crc":
                        archive.write(file, file.relative_to(payload))
            read_snapshot(bundle)
            os.replace(bundle, output)
    print(f"Published release to {output}", flush=True)


def predict(spark, source, release, output):
    with tempfile.TemporaryDirectory(prefix="workforce-predict-") as temporary:
        with ZipFile(release) as archive:
            metadata = read_metadata(archive)
            model_paths = ("raw_encoder/", "derived_encoder/", "predictor/")
            archive.extractall(temporary, members=[
                name for name in archive.namelist() if name.startswith(model_paths)
            ])
        directory = Path(temporary)
        raw = validate_input(load_data(spark, source.as_uri()), training=False)
        encoder = PipelineModel.load((directory / "raw_encoder").as_uri())
        derived = PipelineModel.load((directory / "derived_encoder").as_uri())
        predictor = PipelineModel.load((directory / "predictor").as_uri())
        engineered = derived.transform(add_features(encoder.transform(raw)))
        columns = ["PredictedAttrition", "AttritionVoteShare", "PredictedPerformance", "RiskScore", "cluster"]
        if "EmployeeNumber" in raw.columns:
            columns.insert(0, "EmployeeNumber")
        result = score(engineered, predictor).select(*columns).toPandas()
    result["Segment"] = result.pop("cluster").astype(str).map(metadata["segments"])
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, delete=False, suffix=".csv") as temporary:
        staged = Path(temporary.name)
    try:
        result.to_csv(staged, index=False)
        os.replace(staged, output)
    finally:
        staged.unlink(missing_ok=True)
    print(f"Wrote {len(result):,} predictions to {output}", flush=True)
