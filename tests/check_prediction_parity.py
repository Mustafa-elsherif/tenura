"""Compare the shipped release with the original Spark path on the full demo CSV."""

import sys
import tempfile
from pathlib import Path

from pandas.testing import assert_frame_equal
from pyspark.ml.classification import RandomForestClassificationModel
from pyspark.ml.functions import vector_to_array
from pyspark.ml.regression import RandomForestRegressionModel
from pyspark.sql import functions as F

from hr_analytics.data_ingestion import create_spark_session, load_data
from hr_analytics.feature_engineering import engineer_features
from hr_analytics.models import prepare_features
from hr_analytics.preprocessing import encode_categorical_columns
from hr_analytics.release import DEMO_DATA, DEMO_RELEASE, ROOT
from hr_analytics.workflow import predict, regression_features


def main():
    spark = create_spark_session()
    try:
        source = load_data(spark, DEMO_DATA.as_posix())
        original = engineer_features(encode_categorical_columns(source))
        classifier = RandomForestClassificationModel.load((ROOT / "models/attrition_model").as_posix())
        regressor = RandomForestRegressionModel.load((ROOT / "models/performance_model").as_posix())
        classification = classifier.transform(prepare_features(original)).select(
            "EmployeeNumber", F.when(F.col("prediction") == 1, "Yes").otherwise("No").alias("PredictedAttrition"),
            vector_to_array("probability")[1].alias("AttritionModelScore"), "RiskScore",
        )
        regression = regressor.transform(regression_features(original)).select(
            "EmployeeNumber", F.col("prediction").alias("PredictedPerformance"),
        )
        reference = classification.join(regression, "EmployeeNumber").orderBy("EmployeeNumber").toPandas()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "predictions.csv"
            # The scorer should work with a raw batch that does not include the target.
            batch = Path(directory) / "unlabelled.csv"
            source.drop("Attrition").toPandas().to_csv(batch, index=False)
            predict(spark, batch, Path(sys.argv[1]) if len(sys.argv) > 1 else DEMO_RELEASE, output)
            import pandas as pd
            actual = pd.read_csv(output, dtype={"PredictedAttrition": str}).sort_values("EmployeeNumber")
        assert_frame_equal(reference, actual[reference.columns].reset_index(drop=True),
                           check_dtype=False, atol=1e-12, rtol=0)
        print(f"Prediction parity confirmed for all {len(reference):,} original records.")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
