import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { Card, RiskMeter, DriverList } from "./ui";
import type { PredictResult } from "./types";

type FieldNum = { kind: "num"; key: string; label: string; min: number; max: number; step?: number; hint?: string };
type FieldCat = { kind: "cat"; key: string; label: string; options: string[] };
type Field = FieldNum | FieldCat;

export default function Predict() {
  const model = api.clientModel();
  const cats = useMemo(() => Object.fromEntries(model.categorical.map((c) => [c.feature, c.categories])), [model]);

  const fields: Field[] = [
    { kind: "cat", key: "OverTime", label: "Works overtime", options: cats.OverTime },
    { kind: "num", key: "MonthlyIncome", label: "Monthly income ($)", min: 1000, max: 20000, step: 100 },
    { kind: "num", key: "Age", label: "Age", min: 18, max: 60 },
    { kind: "num", key: "JobLevel", label: "Job level", min: 1, max: 5 },
    { kind: "num", key: "JobSatisfaction", label: "Job satisfaction (1–4)", min: 1, max: 4 },
    { kind: "num", key: "EnvironmentSatisfaction", label: "Environment satisfaction (1–4)", min: 1, max: 4 },
    { kind: "num", key: "WorkLifeBalance", label: "Work-life balance (1–4)", min: 1, max: 4 },
    { kind: "num", key: "YearsAtCompany", label: "Years at company", min: 0, max: 40 },
    { kind: "num", key: "YearsSinceLastPromotion", label: "Years since promotion", min: 0, max: 15 },
    { kind: "num", key: "YearsWithCurrManager", label: "Years with manager", min: 0, max: 17 },
    { kind: "num", key: "StockOptionLevel", label: "Stock option level", min: 0, max: 3 },
    { kind: "num", key: "DistanceFromHome", label: "Commute distance (km)", min: 1, max: 29 },
    { kind: "cat", key: "BusinessTravel", label: "Business travel", options: cats.BusinessTravel },
    { kind: "cat", key: "Department", label: "Department", options: cats.Department },
    { kind: "cat", key: "JobRole", label: "Job role", options: cats.JobRole },
    { kind: "cat", key: "MaritalStatus", label: "Marital status", options: cats.MaritalStatus },
  ];

  const [form, setForm] = useState<Record<string, number | string>>(() => {
    const init: Record<string, number | string> = {};
    for (const f of fields) init[f.key] = model.defaults[f.key];
    return init;
  });
  const [result, setResult] = useState<PredictResult | null>(null);

  useEffect(() => {
    let active = true;
    api.predict(form).then((r) => active && setResult(r));
    return () => { active = false; };
  }, [form]);

  const set = (k: string, v: number | string) => setForm((f) => ({ ...f, [k]: v }));

  const presetHighRisk = () => setForm({
    ...form, OverTime: "Yes", MonthlyIncome: 2400, JobSatisfaction: 1, EnvironmentSatisfaction: 1,
    WorkLifeBalance: 1, Age: 25, YearsSinceLastPromotion: 6, StockOptionLevel: 0,
    MaritalStatus: "Single", BusinessTravel: "Travel_Frequently", JobLevel: 1,
  });
  const presetReset = () => {
    const init: Record<string, number | string> = {};
    for (const f of fields) init[f.key] = model.defaults[f.key];
    setForm(init);
  };

  return (
    <div className="grid cols-2" style={{ alignItems: "start" }}>
      <Card title="What-if predictor" note="Adjust an employee profile and see risk update live — powered by the real trained model"
        right={<div className="row" style={{ gap: 6 }}>
          <button className="chip" onClick={presetHighRisk}>High-risk example</button>
          <button className="chip" onClick={presetReset}>Reset</button>
        </div>}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {fields.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              {f.kind === "cat" ? (
                <select id={f.key} className="select" value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </select>
              ) : (
                <input id={f.key} className="input" type="number" min={f.min} max={f.max} step={f.step ?? 1}
                  value={Number(form[f.key])} onChange={(e) => set(f.key, Number(e.target.value))} />
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid" style={{ gap: 18, position: "sticky", top: 20 }}>
        <Card title="Predicted risk">
          {result ? <RiskMeter score={result.risk_score} band={result.risk_band} /> : <div className="skeleton" style={{ height: 80 }} />}
        </Card>
        <Card title="Top drivers for this profile" note="Why the model scored it this way">
          {result ? <DriverList drivers={result.top_drivers} /> : <div className="skeleton" style={{ height: 160 }} />}
        </Card>
      </div>
    </div>
  );
}
