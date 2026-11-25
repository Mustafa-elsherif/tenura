export type Band = "Low" | "Moderate" | "High" | "Critical";

export interface Driver {
  feature: string;
  label: string;
  impact: number;
  direction: "increases" | "reduces";
  action: string | null;
}

export interface Employee {
  id: number;
  age: number;
  department: string;
  job_role: string;
  job_level: number;
  monthly_income: number;
  years_at_company: number;
  overtime: string;
  business_travel: string;
  gender: string;
  marital_status: string;
  job_satisfaction: number;
  work_life_balance: number;
  years_since_promotion: number;
  attrition_actual: string;
  risk_score: number;
  risk_band: Band;
  top_drivers: Driver[];
}

export interface Importance { feature: string; label: string; importance: number; }

export interface SplitMetrics {
  split: string; n: number; roc_auc: number; pr_auc: number;
  f1: number; precision: number; recall: number; brier: number;
}

export interface Metrics {
  product: string;
  dataset: { name: string; rows: number; features: number; positive_rate: number };
  selected_model: string;
  leaderboard: { model: string; cv_roc_auc: number; cv_roc_auc_std: number; cv_pr_auc: number }[];
  validation: SplitMetrics;
  test: SplitMetrics;
  calibration: string;
  trained_at: string;
  overview: {
    headcount: number; attrition_rate: number; high_risk_count: number;
    critical_count: number; avg_risk_score: number;
  };
}

export interface SegmentRow {
  name: string; headcount: number; avg_risk: number; high_risk: number; actual_attrition: number;
}
export interface Segments {
  by_department: SegmentRow[];
  by_job_role: SegmentRow[];
  by_band: { name: string; headcount: number }[];
  by_overtime: SegmentRow[];
  by_business_travel: SegmentRow[];
}

export interface PredictResult { risk_score: number; risk_band: Band; top_drivers: Driver[]; }

export interface ClientModel {
  numeric_features: string[];
  raw_numeric: string[];
  scaler_mean: number[];
  scaler_scale: number[];
  numeric_coef: number[];
  numeric_bg: number[];
  categorical: { feature: string; categories: string[]; coef: number[]; bg: number[] }[];
  intercept: number;
  calibration: { x: number[]; y: number[] };
  bands: { Critical: number; High: number; Moderate: number };
  defaults: Record<string, number | string>;
}
