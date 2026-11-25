"""Feature engineering shared by the training pipeline and the backend API.

This module is the single source of truth for how a raw IBM-HR style employee
record is turned into the feature columns the model consumes. Both the offline
training job (`ml/train.py`) and the live API (`backend/app`) import it so the
engineered columns are guaranteed identical at train time and at serve time.
"""
from __future__ import annotations

import pandas as pd

# Columns that are constant in the source data and carry no signal.
CONSTANT_COLUMNS = ["EmployeeCount", "Over18", "StandardHours"]

# Identifier column — kept for joining, never fed to the model.
ID_COLUMN = "EmployeeNumber"

TARGET_COLUMN = "Attrition"

# Raw numeric features kept as-is.
RAW_NUMERIC = [
    "Age", "DailyRate", "DistanceFromHome", "Education", "EnvironmentSatisfaction",
    "HourlyRate", "JobInvolvement", "JobLevel", "JobSatisfaction", "MonthlyIncome",
    "MonthlyRate", "NumCompaniesWorked", "PercentSalaryHike", "PerformanceRating",
    "RelationshipSatisfaction", "StockOptionLevel", "TotalWorkingYears",
    "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany", "YearsInCurrentRole",
    "YearsSinceLastPromotion", "YearsWithCurrManager",
]

# Categorical features.
CATEGORICAL = [
    "BusinessTravel", "Department", "EducationField", "Gender", "JobRole",
    "MaritalStatus", "OverTime",
]

# Engineered numeric features created in `engineer_features`.
ENGINEERED = [
    "TenureRatio", "IncomePerLevel", "PromotionStagnation", "ManagerStability",
    "AgeAtJoining", "SatisfactionIndex", "IncomePerYearWorked", "RoleTenureShare",
]

NUMERIC_FEATURES = RAW_NUMERIC + ENGINEERED
ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of ``df`` with engineered columns added.

    Safe to call on a single-row frame (the API path) or the full dataset
    (training). Uses ``+ 1`` guards so no division by zero is possible.
    """
    out = df.copy()

    out["TenureRatio"] = out["YearsAtCompany"] / (out["TotalWorkingYears"] + 1)
    out["IncomePerLevel"] = out["MonthlyIncome"] / out["JobLevel"].clip(lower=1)
    out["PromotionStagnation"] = out["YearsSinceLastPromotion"] / (out["YearsAtCompany"] + 1)
    out["ManagerStability"] = out["YearsWithCurrManager"] / (out["YearsAtCompany"] + 1)
    out["AgeAtJoining"] = out["Age"] - out["YearsAtCompany"]
    out["SatisfactionIndex"] = out[
        ["JobSatisfaction", "EnvironmentSatisfaction", "RelationshipSatisfaction", "WorkLifeBalance"]
    ].mean(axis=1)
    out["IncomePerYearWorked"] = out["MonthlyIncome"] / (out["TotalWorkingYears"] + 1)
    out["RoleTenureShare"] = out["YearsInCurrentRole"] / (out["YearsAtCompany"] + 1)

    return out


# Human-readable labels + plain-language meaning for every feature the model
# can surface as a driver. Used by the API and dashboard so explanations never
# show a raw column name to an end user.
FEATURE_LABELS: dict[str, str] = {
    "Age": "Age",
    "DailyRate": "Daily rate",
    "DistanceFromHome": "Commute distance",
    "Education": "Education level",
    "EnvironmentSatisfaction": "Environment satisfaction",
    "HourlyRate": "Hourly rate",
    "JobInvolvement": "Job involvement",
    "JobLevel": "Job level",
    "JobSatisfaction": "Job satisfaction",
    "MonthlyIncome": "Monthly income",
    "MonthlyRate": "Monthly rate",
    "NumCompaniesWorked": "Number of prior employers",
    "PercentSalaryHike": "Last salary hike %",
    "PerformanceRating": "Performance rating",
    "RelationshipSatisfaction": "Relationship satisfaction",
    "StockOptionLevel": "Stock option level",
    "TotalWorkingYears": "Total working years",
    "TrainingTimesLastYear": "Trainings last year",
    "WorkLifeBalance": "Work-life balance",
    "YearsAtCompany": "Years at company",
    "YearsInCurrentRole": "Years in current role",
    "YearsSinceLastPromotion": "Years since last promotion",
    "YearsWithCurrManager": "Years with current manager",
    "TenureRatio": "Share of career spent here",
    "IncomePerLevel": "Pay for job level",
    "PromotionStagnation": "Promotion stagnation",
    "ManagerStability": "Manager stability",
    "AgeAtJoining": "Age when joined",
    "SatisfactionIndex": "Overall satisfaction",
    "IncomePerYearWorked": "Pay per year of experience",
    "RoleTenureShare": "Time settled in current role",
    "BusinessTravel": "Business travel",
    "Department": "Department",
    "EducationField": "Field of study",
    "Gender": "Gender",
    "JobRole": "Job role",
    "MaritalStatus": "Marital status",
    "OverTime": "Works overtime",
}


def pretty_feature(name: str) -> str:
    """Map an encoded feature name (possibly ``col_value`` from one-hot) to a label."""
    if name in FEATURE_LABELS:
        return FEATURE_LABELS[name]
    # One-hot encoded "Column_Value" -> "Label: Value"
    for col in CATEGORICAL:
        prefix = f"{col}_"
        if name.startswith(prefix):
            value = name[len(prefix):]
            return f"{FEATURE_LABELS.get(col, col)}: {value}"
    return name
