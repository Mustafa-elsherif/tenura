"""Pydantic request/response schemas for the Tenura API."""
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class BusinessTravelE(str, Enum):
    rarely = "Travel_Rarely"
    frequently = "Travel_Frequently"
    non_travel = "Non-Travel"


class DepartmentE(str, Enum):
    sales = "Sales"
    rnd = "Research & Development"
    hr = "Human Resources"


class EducationFieldE(str, Enum):
    life_sciences = "Life Sciences"
    other = "Other"
    medical = "Medical"
    marketing = "Marketing"
    technical = "Technical Degree"
    hr = "Human Resources"


class GenderE(str, Enum):
    female = "Female"
    male = "Male"


class JobRoleE(str, Enum):
    sales_executive = "Sales Executive"
    research_scientist = "Research Scientist"
    lab_technician = "Laboratory Technician"
    manufacturing_director = "Manufacturing Director"
    healthcare_rep = "Healthcare Representative"
    manager = "Manager"
    sales_rep = "Sales Representative"
    research_director = "Research Director"
    hr = "Human Resources"


class MaritalStatusE(str, Enum):
    single = "Single"
    married = "Married"
    divorced = "Divorced"


class YesNoE(str, Enum):
    yes = "Yes"
    no = "No"


class EmployeeInput(BaseModel):
    """A single employee record for a what-if prediction. Defaults are dataset
    medians / modes so a partial form still produces a realistic baseline."""

    Age: int = Field(36, ge=18, le=70)
    DailyRate: int = Field(802, ge=1)
    DistanceFromHome: int = Field(7, ge=1, le=60)
    Education: int = Field(3, ge=1, le=5)
    EnvironmentSatisfaction: int = Field(3, ge=1, le=4)
    HourlyRate: int = Field(66, ge=1)
    JobInvolvement: int = Field(3, ge=1, le=4)
    JobLevel: int = Field(2, ge=1, le=5)
    JobSatisfaction: int = Field(3, ge=1, le=4)
    MonthlyIncome: int = Field(4919, ge=1)
    MonthlyRate: int = Field(14235, ge=1)
    NumCompaniesWorked: int = Field(2, ge=0, le=20)
    PercentSalaryHike: int = Field(14, ge=0, le=100)
    PerformanceRating: int = Field(3, ge=1, le=4)
    RelationshipSatisfaction: int = Field(3, ge=1, le=4)
    StockOptionLevel: int = Field(1, ge=0, le=3)
    TotalWorkingYears: int = Field(10, ge=0, le=50)
    TrainingTimesLastYear: int = Field(3, ge=0, le=10)
    WorkLifeBalance: int = Field(3, ge=1, le=4)
    YearsAtCompany: int = Field(5, ge=0, le=50)
    YearsInCurrentRole: int = Field(3, ge=0, le=50)
    YearsSinceLastPromotion: int = Field(1, ge=0, le=50)
    YearsWithCurrManager: int = Field(3, ge=0, le=50)
    BusinessTravel: BusinessTravelE = BusinessTravelE.rarely
    Department: DepartmentE = DepartmentE.rnd
    EducationField: EducationFieldE = EducationFieldE.life_sciences
    Gender: GenderE = GenderE.male
    JobRole: JobRoleE = JobRoleE.research_scientist
    MaritalStatus: MaritalStatusE = MaritalStatusE.married
    OverTime: YesNoE = YesNoE.no

    def to_record(self) -> dict:
        """Plain dict with enum values unwrapped to their raw strings."""
        out = {}
        for key, value in self.model_dump().items():
            out[key] = value.value if isinstance(value, Enum) else value
        return out


class Driver(BaseModel):
    feature: str
    label: str
    impact: float
    direction: Literal["increases", "reduces"]
    action: Optional[str] = None


class PredictResponse(BaseModel):
    risk_score: float
    risk_band: str
    top_drivers: List[Driver]
