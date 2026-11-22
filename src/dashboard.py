"""Workforce Atlas Streamlit entry point."""

import logging
from pathlib import Path
import sys
from zipfile import BadZipFile

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from hr_analytics.release import DEMO_RELEASE, RISK_THRESHOLD, read_snapshot

GREEN = "#15775A"
AMBER = "#AD572D"
INK = "#21372B"
SLATE = "#526458"
GRID = "#E9EEEA"
SEGMENT_COLORS = {
    "Mid-Career Stable": GREEN,
    "Young High-Risk": AMBER,
    "Senior High-Income": "#586AA2",
}
STATUS_COLORS = {"Stayed": GREEN, "Left": AMBER}
AGE_ORDER = ["18–24", "25–34", "35–44", "45+"]
INCOME_ORDER = ["Up to $3,000", "$3,001–$7,000", "Above $7,000"]

PAGES = {
    "Overview": ("Workforce overview", "Explore workforce composition, observed attrition, and the distribution of retention risk scores."),
    "Attrition": ("Attrition analysis", "Compare observed attrition across age, overtime, income, and gender in the selected cohort."),
    "Segmentation": ("Employee segmentation", "Explore three groups fitted by K-means using age, income, experience, tenure, job level, and the risk score."),
    "Risk explorer": ("Retention risk explorer", "Review the rule-based score by age and segment, then inspect the highest-scoring records."),
    "Recommendations": ("Retention recommendations", "Use the cohort patterns to identify policies and practices worth investigating."),
    "Model evaluation": ("Model evaluation", "Selected evaluation results and the fitted feature importance for the models packaged with this release."),
}

RECOMMENDATIONS = {
    "Overtime policy": [
        "Review a proposed overtime cap of 10 hours per week.",
        "Assess compensation or time-off policies and monitor repeated overtime.",
        "Redistribute workload across the teams most reliant on overtime.",
    ],
    "Compensation": [
        "Benchmark pay for lower-income roles, including those earning up to $3,000 per month.",
        "Review salary progression, performance-based increases, benefits, and stock options.",
    ],
    "Early-career retention": [
        "Offer career development, mentoring, and certification support across early-career roles.",
        "Make promotion timelines and criteria clear.",
    ],
    "Employee engagement": [
        "Run quarterly satisfaction surveys and support open feedback with management.",
        "Offer cross-functional projects and review recognition programs.",
    ],
    "Retention follow-up": [
        "Consider voluntary monthly check-ins and a review of reported workload.",
        "Evaluate retention support and track changes at the cohort level.",
    ],
}


@st.cache_data(show_spinner=False, max_entries=2)
def load_release(path, modified_ns, size):
    return read_snapshot(path)


def header(page):
    title, description = PAGES[page]
    st.html(f"""
        <div class="wa-hero">
            <span class="wa-source">Workforce Atlas · IBM demo dataset</span>
            <h1>{title}</h1>
            <p>{description}</p>
        </div>
    """)


def chart(figure, *, height=285):
    figure.update_layout(
        height=height, template="plotly_white", paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)", font={"color": SLATE, "size": 12},
        legend={"orientation": "h", "y": -0.24, "title_text": "", "font": {"size": 11}},
        margin={"l": 8, "r": 22, "t": 16, "b": 16},
        hoverlabel={"bgcolor": "white", "font_color": INK},
    )
    figure.update_xaxes(gridcolor=GRID, zeroline=False, automargin=True, title_standoff=8)
    figure.update_yaxes(gridcolor=GRID, zeroline=False, automargin=True, title_standoff=8)
    st.plotly_chart(figure, width="stretch", theme=None,
                    config={"displayModeBar": False, "scrollZoom": False})


def metric_row(items):
    for column, (label, value) in zip(st.columns(len(items)), items, strict=True):
        with column:
            st.metric(label, value)


def chart_card(title, figure, caption, *, height=285):
    with st.container(border=True, key="wa-card-" + title.lower().replace(" ", "-")):
        st.subheader(title)
        chart(figure, height=height)
        st.caption(caption)


def rates(data, group):
    return (data.assign(Left=data["Attrition"].eq("Yes"))
            .groupby(group, observed=True)["Left"]
            .agg(Employees="size", Attrition="mean").reset_index())


def rate_card(data, group, title, caption, *, order=None, height=280):
    summary = rates(data, group)
    if order is None:
        order = summary.sort_values("Attrition", ascending=False)[group].tolist()
    figure = px.bar(summary, x="Attrition", y=group, orientation="h", custom_data=["Employees"],
                    category_orders={group: order}, text_auto=".1%",
                    color_discrete_sequence=[GREEN])
    figure.update_traces(textposition="outside", cliponaxis=False,
                         hovertemplate="%{y}<br>Attrition %{x:.1%}<br>%{customdata[0]:,} records<extra></extra>")
    figure.update_yaxes(autorange="reversed", title=None)
    figure.update_xaxes(tickformat=".0%", range=[0, max(.15, summary["Attrition"].max() * 1.19)],
                        title="Attrition rate")
    chart_card(title, figure, caption, height=height)


def age_groups(data):
    return data.assign(AgeGroup=pd.cut(data["Age"], [-float("inf"), 25, 35, 45, float("inf")],
                                       right=False, labels=AGE_ORDER))


def income_groups(data):
    return data.assign(Band=pd.cut(data["MonthlyIncome"], [-float("inf"), 3000, 7000, float("inf")],
                                   labels=INCOME_ORDER))


def overtime_groups(data):
    return data.assign(Overtime=data["OverTime"].map({"Yes": "Overtime", "No": "No overtime"}))


def overview(data, metrics):
    total = len(data)
    left = data["Attrition"].eq("Yes").sum()
    high_risk = data["RiskScore"].ge(RISK_THRESHOLD).sum()
    metric_row([
        ("Employee records", f"{total:,}"), ("Employees who left", f"{left:,}"),
        ("Observed attrition", f"{left / total:.1%}"), ("High-risk records", f"{high_risk:,}"),
    ])
    st.header("Workforce composition")
    donut = go.Figure(go.Pie(
        labels=["Stayed", "Left"], values=[total - left, left], marker_colors=list(STATUS_COLORS.values()),
        hole=.73, sort=False, textinfo="none",
        hovertemplate="%{label}<br>%{value:,} records · %{percent}<extra></extra>",
    ))
    donut.add_annotation(text=f"<b>{left / total:.1%}</b><br><span style='font-size:11px'>attrition</span>",
                         x=.5, y=.5, showarrow=False, font={"size": 24, "color": INK})
    donut.update_layout(showlegend=False)
    left_column, right_column = st.columns(2, gap="medium")
    with left_column:
        chart_card("Attrition distribution", donut, f"{total-left:,} stayed · {left:,} left")
    with right_column:
        rate_card(data, "Department", "Attrition by department",
                  "Share of records marked as having left in each department.", height=285)

    st.header("Retention and model indicators")
    figure = px.histogram(data, x="RiskScore", nbins=25, color_discrete_sequence=[GREEN],
                          labels={"RiskScore": "Risk score", "count": "Records"})
    figure.add_vline(x=RISK_THRESHOLD, line_dash="dash", line_color=AMBER)
    figure.update_yaxes(title="Records")
    left_column, right_column = st.columns(2, gap="medium")
    with left_column:
        chart_card("Risk score distribution", figure,
                   f"{high_risk:,} records at or above {RISK_THRESHOLD:.2f} · Mean {data['RiskScore'].mean():.3f}")
    with right_column:
        with st.container(border=True, key="wa-card-model-summary"):
            st.subheader("Model performance summary")
            st.table(pd.DataFrame({
                "Model": ["Attrition forest", "Performance forest", "K-means segmentation"],
                "Metric": ["Weighted F1", "R²", "Silhouette"],
                "Value": [f"{metrics['attrition']['f1']:.3f}", f"{metrics['performance']['r2']:.3f}",
                          f"{metrics['silhouette']:.3f}"],
            }).set_index("Model"))
            st.caption("Evaluation uses the full release. Department filters apply to workforce charts.")


def attrition(data):
    age, overtime = st.columns(2, gap="medium")
    with age:
        rate_card(age_groups(data), "AgeGroup", "Attrition by age",
                  "Age groups use inclusive lower bounds.", order=AGE_ORDER)
    with overtime:
        rate_card(overtime_groups(data), "Overtime", "Attrition by overtime",
                  "Overtime status comes from the source dataset.")
    income, gender = st.columns(2, gap="medium")
    with income:
        figure = px.box(data.assign(Status=data["Attrition"].map({"No": "Stayed", "Yes": "Left"})),
                        x="Status", y="MonthlyIncome", color="Status", color_discrete_map=STATUS_COLORS,
                        category_orders={"Status": ["Stayed", "Left"]},
                        labels={"MonthlyIncome": "Monthly income"}, points="outliers")
        figure.update_layout(showlegend=False)
        figure.update_xaxes(title=None)
        figure.update_yaxes(tickprefix="$")
        chart_card("Monthly income by attrition", figure,
                   "Each box covers the middle 50% of the group. The line marks the median.")
    with gender:
        rate_card(data, "Gender", "Attrition by gender", "Gender categories are shown as recorded in the source.")


def segmentation(data):
    summary = data.assign(Overtime=data["OverTime"].eq("Yes")).groupby("Segment").agg(**{
        "Records": ("Age", "size"), "Mean age": ("Age", "mean"), "Mean income": ("MonthlyIncome", "mean"),
        "Mean risk": ("RiskScore", "mean"), "Mean experience": ("TotalWorkingYears", "mean"),
        "Mean engagement": ("EngagementScore", "mean"), "Overtime share": ("Overtime", "mean"),
    }).reindex(list(SEGMENT_COLORS)).dropna(subset=["Records"])
    metric_row([(label, f"{int(row['Records']):,}") for label, row in summary.iterrows()])
    st.header("Segment profiles")
    for column, field, title, label in zip(
        st.columns(2, gap="medium"), ["Age", "TotalWorkingYears"],
        ["Age and monthly income", "Experience and monthly income"], ["Age", "Total working years"], strict=True,
    ):
        with column:
            figure = px.scatter(data, x=field, y="MonthlyIncome", color="Segment", opacity=.7,
                                color_discrete_map=SEGMENT_COLORS,
                                category_orders={"Segment": list(SEGMENT_COLORS)},
                                labels={field: label, "MonthlyIncome": "Monthly income"})
            figure.update_traces(marker_size=6)
            figure.update_yaxes(tickprefix="$")
            chart_card(title, figure, "Select a legend item to show or hide a segment.", height=365)
    st.dataframe(summary, width="stretch", column_config={
        "Records": st.column_config.NumberColumn(format="%d"),
        "Mean income": st.column_config.NumberColumn(format="dollar"),
        "Overtime share": st.column_config.NumberColumn(format="percent"),
        **{name: st.column_config.NumberColumn(format="%.2f") for name in
           ("Mean age", "Mean risk", "Mean experience", "Mean engagement")},
    })


def risk_explorer(data):
    threshold = st.slider("High-risk threshold", min_value=0.0, max_value=1.0, value=RISK_THRESHOLD,
                          step=.01, format="%.2f",
                          help="The score combines overtime, engagement, satisfaction, tenure, and income.")
    high = data.loc[data["RiskScore"].ge(threshold)].sort_values("RiskScore", ascending=False)
    metric_row([
        ("Records at threshold or higher", f"{len(high):,}"), ("Share of cohort", f"{len(high) / len(data):.1%}"),
        ("Mean risk score", f"{high['RiskScore'].mean():.3f}" if len(high) else "—"),
        ("Mean monthly income", f"${high['MonthlyIncome'].mean():,.0f}" if len(high) else "—"),
    ])
    if high.empty:
        st.info("No records meet this threshold. Lower the threshold or select another department.")
        return
    by_segment = high.groupby("Segment").size().rename("Records").reset_index()
    left, right = st.columns(2, gap="medium")
    with left:
        figure = px.bar(by_segment.sort_values("Records"), x="Records", y="Segment", orientation="h",
                        color="Segment", color_discrete_map=SEGMENT_COLORS, text_auto=True)
        figure.update_layout(showlegend=False)
        figure.update_yaxes(title=None)
        chart_card("High-risk records by segment", figure, f"Includes scores of {threshold:.2f} and higher.")
    with right:
        figure = px.scatter(data.assign(Group=data["RiskScore"].ge(threshold).map(
            {True: "High risk", False: "Below threshold"})),
            x="Age", y="RiskScore", color="Group", opacity=.67,
            labels={"RiskScore": "Risk score"}, color_discrete_map={"High risk": AMBER, "Below threshold": GREEN})
        figure.add_hline(y=threshold, line_dash="dash", line_color=AMBER)
        figure.update_traces(marker_size=6)
        chart_card("Age and risk score", figure, "The dashed line marks the selected threshold.")
    st.header("Highest-scoring records")
    st.caption(f"Showing {min(50, len(high)):,} of {len(high):,} matching fictional records.")
    fields = {
        "Age": "Age", "MonthlyIncome": "Monthly income", "JobLevel": "Job level",
        "TotalWorkingYears": "Working years", "YearsAtCompany": "Company tenure",
        "EngagementScore": "Engagement", "SatisfactionScore": "Satisfaction", "RiskScore": "Risk score",
        "Segment": "Segment",
    }
    st.dataframe(high[list(fields)].head(50).rename(columns=fields), hide_index=True, width="stretch",
                 column_config={"Monthly income": st.column_config.NumberColumn(format="dollar"),
                                "Risk score": st.column_config.NumberColumn(format="%.4f")})
    st.caption("The risk score is a weighted heuristic for exploring the demo dataset. Review findings at the cohort level.")


def recommendations(data):
    st.header("Patterns in the selected cohort")
    overtime, income, age = st.columns(3, gap="medium")
    with overtime:
        rate_card(overtime_groups(data), "Overtime", "Overtime", "Observed attrition by overtime status.")
    with income:
        rate_card(income_groups(data), "Band", "Income", "Monthly income bands.", order=INCOME_ORDER)
    with age:
        rate_card(age_groups(data), "AgeGroup", "Age", "Observed attrition by age group.", order=AGE_ORDER)
    st.header("Actions to evaluate")
    st.caption("The dataset is fictional and observational. Measure the impact of any policy changes with appropriate workplace data.")
    for topic, actions in RECOMMENDATIONS.items():
        with st.expander(topic):
            st.markdown("\n".join(f"- {action}" for action in actions))


def model_evaluation(metadata):
    metrics = metadata["metrics"]
    metric_row([
        ("Attrition accuracy", f"{metrics['attrition']['accuracy']:.1%}"),
        ("Performance RMSE", f"{metrics['performance']['rmse']:.4f}"),
        ("Cluster silhouette", f"{metrics['silhouette']:.3f}"),
    ])
    st.header("Supervised model results")
    counts = {(row["actual"], row["predicted"]): row["count"] for row in metrics["confusion"]}
    with st.container(border=True, key="wa-card-confusion"):
        st.subheader("Attrition confusion matrix")
        st.dataframe(pd.DataFrame(
            [[counts.get((actual, predicted), 0) for predicted in (0, 1)] for actual in (0, 1)],
            columns=["Predicted stayed", "Predicted left"], index=["Actual stayed", "Actual left"],
        ), width="stretch")
        st.caption(f"{metrics['attrition_test_records']:,} evaluation records · "
                   f"Weighted F1 {metrics['attrition']['f1']:.3f} · "
                   f"Weighted precision {metrics['attrition']['precision']:.3f} · "
                   f"Weighted recall {metrics['attrition']['recall']:.3f}")
    with st.container(border=True, key="wa-card-regression"):
        st.subheader("Performance regression")
        st.write(f"R² **{metrics['performance']['r2']:.4f}** · MAE **{metrics['performance']['mae']:.4f}**")
        st.caption(f"{metrics['performance_test_records']:,} evaluation records · "
                   "Salary hike is closely associated with the recorded rating in this dataset. "
                   "That relationship limits how much the result tells us about performance in other settings.")
    importance = pd.DataFrame(metrics["importance"]).nlargest(10, "importance").sort_values("importance")
    importance["feature"] = (importance["feature"].str.removesuffix("_encoded")
                             .str.replace(r"(?<=[a-z])(?=[A-Z])", " ", regex=True))
    figure = px.bar(importance, x="importance", y="feature", orientation="h",
                    color_discrete_sequence=[GREEN])
    figure.update_xaxes(title="Relative importance")
    figure.update_yaxes(title=None)
    chart_card("Attrition model feature importance", figure,
               "The ten most influential inputs by Spark’s impurity-based importance.", height=355)


def run():
    st.set_page_config(page_title="Workforce Atlas", page_icon="📊", layout="wide",
                       initial_sidebar_state="auto")
    st.html(ROOT / "src" / "dashboard.css")
    with st.sidebar:
        st.html("""<div class="wa-brand"><span class="wa-brand-mark" aria-hidden="true">WA</span>
            <div><strong>Workforce Atlas</strong><small>People analytics</small></div></div>""")
        page = st.radio("Navigation", list(PAGES), label_visibility="collapsed",
                        key="page", index=list(PAGES).index(st.query_params.get("view", "Overview"))
                        if st.query_params.get("view") in PAGES else 0)
        st.query_params["view"] = page
        st.divider()

    header(page)
    try:
        with st.spinner("Loading workforce data…", show_time=True):
            release_stat = DEMO_RELEASE.stat()
            data, metadata = load_release(DEMO_RELEASE, release_stat.st_mtime_ns, release_stat.st_size)
    except (OSError, BadZipFile, ValueError, KeyError):
        logging.exception("Could not load the packaged workforce release")
        st.error("The workforce snapshot could not be loaded. Restore a verified demo release, then reload this page.")
        st.stop()

    with st.sidebar:
        department = st.selectbox("Department", ["All departments", *sorted(data["Department"].unique())],
                                  disabled=page == "Model evaluation")
        st.caption(f"{len(data):,} fictional records · IBM HR sample")
        st.markdown("[Dataset source](https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset)")

    if page == "Model evaluation":
        model_evaluation(metadata)
        return

    cohort = data if department == "All departments" else data.loc[data["Department"].eq(department)]
    if cohort.empty:
        st.info("No records match the selected department.")
        return
    if page == "Overview":
        overview(cohort, metadata["metrics"])
    else:
        {"Attrition": attrition, "Segmentation": segmentation,
         "Risk explorer": risk_explorer, "Recommendations": recommendations}[page](cohort)


run()
