// Data layer. The dashboard works two ways:
//  • Live API    — if VITE_API_BASE is set and /health responds, reads from the
//                  FastAPI backend.
//  • Bundled demo — otherwise reads the artifacts bundled at build time and runs
//                  the what-if model in the browser (scorer.ts). This keeps the
//                  public GitHub Pages site fully interactive with no server.
import { predict as localPredict, band as localBand } from "./scorer";
import type {
  ClientModel, Employee, Importance, Metrics, PredictResult, Segments,
} from "./types";

const BASE = import.meta.env.BASE_URL;
const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "");

let _employees: Employee[] | null = null;
let _metrics: Metrics | null = null;
let _segments: Segments | null = null;
let _drivers: Importance[] | null = null;
let _model: ClientModel | null = null;
let _live = false;

async function j<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}data/${path}`);
  if (!r.ok) throw new Error(`Failed to load ${path}`);
  return r.json();
}

export async function init(): Promise<{ live: boolean }> {
  // Probe the backend if configured.
  if (API) {
    try {
      const h = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2500) });
      _live = h.ok;
    } catch { _live = false; }
  }
  const [emps, met, seg, drv, mdl] = await Promise.all([
    j<Employee[]>("scored_employees.json"),
    j<Metrics>("metrics.json"),
    j<Segments>("segments.json"),
    j<Importance[]>("feature_importance.json"),
    j<ClientModel>("client_model.json"),
  ]);
  _employees = emps; _metrics = met; _segments = seg; _drivers = drv; _model = mdl;
  return { live: _live };
}

export const dataSource = () => (_live ? "Live API" : "Bundled dataset");
export const metrics = () => _metrics!;
export const segments = () => _segments!;
export const drivers = () => _drivers!;
export const clientModel = () => _model!;
export const allEmployees = () => _employees!;

export interface EmployeeQuery {
  department?: string; risk_band?: string; overtime?: string; search?: string;
  sort_by?: string; order?: "asc" | "desc"; limit?: number; offset?: number;
}

export function queryEmployees(q: EmployeeQuery) {
  let rows = _employees!.slice();
  if (q.department) rows = rows.filter((r) => r.department === q.department);
  if (q.overtime) rows = rows.filter((r) => r.overtime === q.overtime);
  if (q.risk_band) {
    const bands = new Set(q.risk_band.split(","));
    rows = rows.filter((r) => bands.has(r.risk_band));
  }
  if (q.search) {
    const s = q.search.trim().toLowerCase();
    if (/^\d+$/.test(s)) rows = rows.filter((r) => String(r.id).startsWith(s));
    else rows = rows.filter((r) => r.job_role.toLowerCase().includes(s) || r.department.toLowerCase().includes(s));
  }
  const sortBy = (q.sort_by ?? "risk_score") as keyof Employee;
  const dir = q.order === "asc" ? 1 : -1;
  rows.sort((a, b) => (a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : 0) * dir);
  const total = rows.length;
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 25;
  return { total, offset, limit, items: rows.slice(offset, offset + limit) };
}

export async function predict(record: Record<string, number | string>): Promise<PredictResult> {
  if (_live && API) {
    const r = await fetch(`${API}/predict`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record),
    });
    if (r.ok) return r.json();
  }
  return localPredict(_model!, record);
}

// ---- Client-side CSV batch scoring (bundled mode) ----
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface BatchRow { row: number; id: number; risk_score: number; risk_band: string; }

export async function predictBatch(file: File): Promise<BatchRow[]> {
  const text = await file.text();
  if (_live && API) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API}/predict/batch`, { method: "POST", body: fd });
    if (r.ok) return (await r.json()).results;
  }
  const rows = parseCsv(text);
  const m = _model!;
  const num = [
    "Age", "DailyRate", "DistanceFromHome", "Education", "EnvironmentSatisfaction", "HourlyRate",
    "JobInvolvement", "JobLevel", "JobSatisfaction", "MonthlyIncome", "MonthlyRate", "NumCompaniesWorked",
    "PercentSalaryHike", "PerformanceRating", "RelationshipSatisfaction", "StockOptionLevel",
    "TotalWorkingYears", "TrainingTimesLastYear", "WorkLifeBalance", "YearsAtCompany",
    "YearsInCurrentRole", "YearsSinceLastPromotion", "YearsWithCurrManager",
  ];
  const results = rows.map((raw, i) => {
    const rec: Record<string, number | string> = {};
    for (const k of Object.keys(raw)) rec[k] = num.includes(k) ? Number(raw[k]) : raw[k];
    const p = localPredict(m, rec);
    return {
      row: i,
      id: raw.EmployeeNumber ? Number(raw.EmployeeNumber) : i + 1,
      risk_score: p.risk_score,
      risk_band: p.risk_band,
    };
  });
  results.sort((a, b) => b.risk_score - a.risk_score);
  return results;
}

export { localBand };
