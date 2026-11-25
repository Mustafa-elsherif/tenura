import * as api from "./api";
import { Card } from "./ui";
import { DriverBars, pct } from "./charts";

export default function Drivers() {
  const m = api.metrics();
  const drivers = api.drivers();
  const t = m.test;

  const metricTiles = [
    { label: "ROC-AUC", value: t.roc_auc.toFixed(3), hint: "Ranking quality" },
    { label: "PR-AUC", value: t.pr_auc.toFixed(3), hint: "Precision–recall" },
    { label: "Recall", value: pct(t.recall), hint: "Leavers caught @0.5" },
    { label: "Brier", value: t.brier.toFixed(3), hint: "Calibration error" },
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid cols-2">
        <Card title="Global attrition drivers" note="Mean |SHAP| contribution across all employees — bigger means more influence on risk">
          <DriverBars data={drivers} maxItems={14} />
        </Card>
        <div className="grid" style={{ gap: 18, alignContent: "start" }}>
          <Card title="Model performance" note={`${m.selected_model} · held-out test split (${t.n} employees)`}>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {metricTiles.map((x) => (
                <div key={x.label} className="metric-mini" style={{ padding: "12px 14px", background: "var(--brand-050)", borderRadius: 12 }}>
                  <b style={{ fontSize: 22 }}>{x.value}</b>
                  <span>{x.label} · {x.hint}</span>
                </div>
              ))}
            </div>
            <div className="sep" />
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Probabilities are calibrated ({m.calibration}). Trained on an honest 70/15/15 stratified split of {m.dataset.rows.toLocaleString()} employees and {m.dataset.features} features.
            </div>
          </Card>
          <Card title="Model selection" note="Cross-validated ROC-AUC on the training split">
            <div className="stacklist">
              {m.leaderboard.map((l) => (
                <div key={l.model} className="spread" style={{ padding: "9px 0", borderBottom: "1px solid var(--ring)" }}>
                  <span style={{ fontSize: 13.5, fontWeight: l.model === m.selected_model ? 700 : 550 }}>
                    {l.model}{l.model === m.selected_model && <span className="band Low" style={{ marginLeft: 8 }}>selected</span>}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 650 }}>{l.cv_roc_auc.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
