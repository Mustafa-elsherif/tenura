import unittest
from pathlib import Path
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

from hr_analytics.release import DEMO_DATA, DEMO_RELEASE, RISK_THRESHOLD, csv_digest, read_snapshot


APP = Path(__file__).resolve().parents[1] / "src" / "dashboard.py"


class SnapshotTests(unittest.TestCase):
    def test_packaged_data_matches_source_and_original_counts(self):
        data, metadata = read_snapshot(DEMO_RELEASE)
        self.assertEqual(metadata["source_sha256"], csv_digest(DEMO_DATA))
        self.assertEqual(len(data), 1470)
        self.assertEqual(data["Attrition"].eq("Yes").sum(), 237)
        self.assertEqual(data["RiskScore"].ge(RISK_THRESHOLD).sum(), 194)
        self.assertEqual(data["Segment"].nunique(), 3)
        self.assertEqual(sum(row["count"] for row in metadata["metrics"]["confusion"]),
                         metadata["metrics"]["attrition_test_records"])


class DashboardTests(unittest.TestCase):
    def test_all_views_render(self):
        expected_charts = {
            "Overview": 3, "Attrition": 4, "Segmentation": 2,
            "Risk explorer": 2, "Recommendations": 3, "Model evaluation": 1,
        }
        app = AppTest.from_file(APP).run()
        for page, charts in expected_charts.items():
            with self.subTest(page=page):
                app.radio[0].set_value(page).run()
                self.assertFalse(app.exception)
                self.assertFalse(app.error)
                self.assertEqual(len(app.get("plotly_chart")), charts)
                self.assertEqual(app.query_params["view"], page)

    def test_department_and_risk_threshold(self):
        app = AppTest.from_file(APP).run()
        app.selectbox[0].set_value("Sales").run()
        data, _ = read_snapshot(DEMO_RELEASE)
        sales = data.loc[data["Department"].eq("Sales")]
        self.assertEqual(app.metric[0].value, f"{len(sales):,}")
        self.assertEqual(app.metric[2].value, f"{sales['Attrition'].eq('Yes').mean():.1%}")
        app.radio[0].set_value("Risk explorer").run()
        self.assertEqual(app.dataframe[0].value.shape, (50, 9))
        app.slider[0].set_value(1.0).run()
        self.assertEqual(app.metric[0].value, "0")
        self.assertIn("No records meet", app.info[0].value)
        self.assertFalse(app.exception)

    def test_broken_release_surfaces_an_actionable_error(self):
        with patch("hr_analytics.release.DEMO_RELEASE", APP.with_suffix(".missing")):
            app = AppTest.from_file(APP).run()
        self.assertFalse(app.exception)
        self.assertIn("Restore a verified demo release", app.error[0].value)


if __name__ == "__main__":
    unittest.main()
