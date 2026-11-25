// Browser-side replica of the served Logistic Regression model.
// Uses the real coefficients, scaler, one-hot categories and isotonic
// calibration exported by ml/train.py, so the live demo's what-if predictor
// produces the same risk score the backend would — no server required.
import type { Band, ClientModel, Driver, PredictResult } from "./types";

const FEATURE_LABELS: Record<string, string> = {
  Age: "Age", DailyRate: "Daily rate", DistanceFromHome: "Commute distance",
  Education: "Education level", EnvironmentSatisfaction: "Environment satisfaction",
  HourlyRate: "Hourly rate", JobInvolvement: "Job involvement", JobLevel: "Job level",
  JobSatisfaction: "Job satisfaction", MonthlyIncome: "Monthly income", MonthlyRate: "Monthly rate",
  NumCompaniesWorked: "Number of prior employers", PercentSalaryHike: "Last salary hike %",
  PerformanceRating: "Performance rating", RelationshipSatisfaction: "Relationship satisfaction",
  StockOptionLevel: "Stock option level", TotalWorkingYears: "Total working years",
  TrainingTimesLastYear: "Trainings last year", WorkLifeBalance: "Work-life balance",
  YearsAtCompany: "Years at company", YearsInCurrentRole: "Years in current role",
  YearsSinceLastPromotion: "Years since last promotion", YearsWithCurrManager: "Years with current manager",
  TenureRatio: "Share of career spent here", IncomePerLevel: "Pay for job level",
  PromotionStagnation: "Promotion stagnation", ManagerStability: "Manager stability",
  AgeAtJoining: "Age when joined", SatisfactionIndex: "Overall satisfaction",
  IncomePerYearWorked: "Pay per year of experience", RoleTenureShare: "Time settled in current role",
  BusinessTravel: "Business travel", Department: "Department", EducationField: "Field of study",
  Gender: "Gender", JobRole: "Job role", MaritalStatus: "Marital status", OverTime: "Works overtime",
};

const ACTIONS: Record<string, string> = {
  OverTime: "Rebalance workload or formalise overtime pay; sustained overtime is a top attrition driver.",
  MonthlyIncome: "Benchmark compensation against market; this employee may be underpaid for their level.",
  IncomePerLevel: "Review pay equity for the job level — compensation looks low for the responsibility.",
  IncomePerYearWorked: "Check that pay has kept pace with accumulated experience.",
  StockOptionLevel: "Consider adding or increasing equity to strengthen long-term commitment.",
  YearsSinceLastPromotion: "Open a career-progression conversation; promotion has stalled.",
  PromotionStagnation: "Build a concrete promotion or growth plan — advancement has stagnated.",
  JobSatisfaction: "Run a stay interview to surface and fix satisfaction blockers.",
  EnvironmentSatisfaction: "Address workplace-environment concerns raised in engagement surveys.",
  SatisfactionIndex: "Overall satisfaction is low — prioritise a manager-led stay interview.",
  WorkLifeBalance: "Offer flexibility or workload relief to improve work-life balance.",
  JobInvolvement: "Increase ownership and meaningful work to lift engagement.",
  DistanceFromHome: "Explore hybrid or remote options to ease a long commute.",
  Age: "Tailor retention to career stage with targeted development or mentoring.",
  TotalWorkingYears: "Match growth opportunities to the employee's experience level.",
  YearsAtCompany: "Recognise tenure and re-energise with a fresh challenge or lateral move.",
  YearsWithCurrManager: "Assess the manager relationship; low manager tenure can raise flight risk.",
  ManagerStability: "Stabilise reporting lines — frequent manager changes erode retention.",
  BusinessTravel: "Reduce or better support travel load where it is driving fatigue.",
  NumCompaniesWorked: "Reinforce belonging and growth path for a historically mobile hire.",
  JobRole: "Review role-specific retention risks and career ladders.",
  MaritalStatus: "Ensure benefits and flexibility fit the employee's life stage.",
};

const ENGINEERED = new Set([
  "TenureRatio", "IncomePerLevel", "PromotionStagnation", "ManagerStability",
  "AgeAtJoining", "SatisfactionIndex", "IncomePerYearWorked", "RoleTenureShare",
]);

type Rec = Record<string, number | string>;

function engineer(r: Rec): Rec {
  const n = (k: string) => Number(r[k]);
  return {
    ...r,
    TenureRatio: n("YearsAtCompany") / (n("TotalWorkingYears") + 1),
    IncomePerLevel: n("MonthlyIncome") / Math.max(n("JobLevel"), 1),
    PromotionStagnation: n("YearsSinceLastPromotion") / (n("YearsAtCompany") + 1),
    ManagerStability: n("YearsWithCurrManager") / (n("YearsAtCompany") + 1),
    AgeAtJoining: n("Age") - n("YearsAtCompany"),
    SatisfactionIndex:
      (n("JobSatisfaction") + n("EnvironmentSatisfaction") +
        n("RelationshipSatisfaction") + n("WorkLifeBalance")) / 4,
    IncomePerYearWorked: n("MonthlyIncome") / (n("TotalWorkingYears") + 1),
    RoleTenureShare: n("YearsInCurrentRole") / (n("YearsAtCompany") + 1),
  };
}

function interp(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1] || 1);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

export function band(score: number, b: ClientModel["bands"]): Band {
  if (score >= b.Critical) return "Critical";
  if (score >= b.High) return "High";
  if (score >= b.Moderate) return "Moderate";
  return "Low";
}

export function predict(model: ClientModel, input: Rec): PredictResult {
  const r = engineer({ ...model.defaults, ...input });

  // Build the transformed feature vector + per-feature SHAP-style contribution.
  let logit = model.intercept;
  const contrib: Record<string, number> = {};

  model.numeric_features.forEach((f, i) => {
    const scaled = (Number(r[f]) - model.scaler_mean[i]) / model.scaler_scale[i];
    logit += model.numeric_coef[i] * scaled;
    contrib[f] = (contrib[f] ?? 0) + model.numeric_coef[i] * (scaled - model.numeric_bg[i]);
  });

  model.categorical.forEach((c) => {
    const value = String(r[c.feature]);
    c.categories.forEach((cat, j) => {
      const active = cat === value ? 1 : 0;
      logit += c.coef[j] * active;
      contrib[c.feature] = (contrib[c.feature] ?? 0) + c.coef[j] * (active - c.bg[j]);
    });
  });

  // The exported isotonic curve maps the LR decision value (logit) directly to
  // a calibrated probability — matching sklearn's CalibratedClassifierCV, which
  // calibrates on decision_function for models that expose it.
  const score = Math.min(1, Math.max(0, interp(logit, model.calibration.x, model.calibration.y)));

  const drivers: Driver[] = Object.entries(contrib)
    .filter(([, v]) => Math.abs(v) > 1e-6)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([feature, impact]) => {
      const isCat = !!model.categorical.find((c) => c.feature === feature);
      const label = isCat
        ? `${FEATURE_LABELS[feature] ?? feature}: ${r[feature]}`
        : FEATURE_LABELS[feature] ?? feature;
      return {
        feature,
        label,
        impact: Math.round(impact * 10000) / 10000,
        direction: impact > 0 ? "increases" : "reduces",
        action: impact > 0 ? ACTIONS[feature] ?? null : null,
      };
    });

  return { risk_score: Math.round(score * 10000) / 10000, risk_band: band(score, model.bands), top_drivers: drivers };
}

export { ENGINEERED, FEATURE_LABELS };
