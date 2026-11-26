import { useEffect, useMemo, useState } from "react";
import * as api from "./api";
import { useI18n } from "./i18n";
import { Card, RiskMeter, DriverList } from "./ui";
import type { PredictResult } from "./types";

type FieldNum = { kind: "num"; key: string; min: number; max: number; step?: number };
type FieldCat = { kind: "cat"; key: string; options: string[] };
type Field = FieldNum | FieldCat;

export default function Predict() {
  const { t, value } = useI18n();
  const model = api.clientModel();
  const cats = useMemo(() => Object.fromEntries(model.categorical.map((c) => [c.feature, c.categories])), [model]);

  const fields: Field[] = [
    { kind: "cat", key: "OverTime", options: cats.OverTime },
    { kind: "num", key: "MonthlyIncome", min: 1000, max: 20000, step: 100 },
    { kind: "num", key: "Age", min: 18, max: 60 },
    { kind: "num", key: "JobLevel", min: 1, max: 5 },
    { kind: "num", key: "JobSatisfaction", min: 1, max: 4 },
    { kind: "num", key: "EnvironmentSatisfaction", min: 1, max: 4 },
    { kind: "num", key: "WorkLifeBalance", min: 1, max: 4 },
    { kind: "num", key: "YearsAtCompany", min: 0, max: 40 },
    { kind: "num", key: "YearsSinceLastPromotion", min: 0, max: 15 },
    { kind: "num", key: "YearsWithCurrManager", min: 0, max: 17 },
    { kind: "num", key: "StockOptionLevel", min: 0, max: 3 },
    { kind: "num", key: "DistanceFromHome", min: 1, max: 29 },
    { kind: "cat", key: "BusinessTravel", options: cats.BusinessTravel },
    { kind: "cat", key: "Department", options: cats.Department },
    { kind: "cat", key: "JobRole", options: cats.JobRole },
    { kind: "cat", key: "MaritalStatus", options: cats.MaritalStatus },
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
      <Card title={t("pred.title")} note={t("pred.note")}
        right={<div className="row" style={{ gap: 6 }}>
          <button className="chip" onClick={presetHighRisk}>{t("pred.high")}</button>
          <button className="chip" onClick={presetReset}>{t("pred.reset")}</button>
        </div>}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {fields.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{t(`f.${f.key}`)}</label>
              {f.kind === "cat" ? (
                <select id={f.key} className="select" value={String(form[f.key])} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o} value={o}>{value(o)}</option>)}
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
        <Card title={t("pred.result")}>
          {result ? <RiskMeter score={result.risk_score} band={result.risk_band} /> : <div className="skeleton" style={{ height: 80 }} />}
        </Card>
        <Card title={t("pred.drivers")} note={t("pred.drivers.note")}>
          {result ? <DriverList drivers={result.top_drivers} /> : <div className="skeleton" style={{ height: 160 }} />}
        </Card>
      </div>
    </div>
  );
}
