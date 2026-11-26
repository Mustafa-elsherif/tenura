import * as api from "./api";
import { useI18n } from "./i18n";
import { Card } from "./ui";
import { DriverBars, pct } from "./charts";

export default function Drivers() {
  const { t } = useI18n();
  const m = api.metrics();
  const drivers = api.drivers();
  const tt = m.test;

  const metricTiles = [
    { label: "ROC-AUC", value: tt.roc_auc.toFixed(3), hint: t("drv.m.roc") },
    { label: "PR-AUC", value: tt.pr_auc.toFixed(3), hint: t("drv.m.pr") },
    { label: "Recall", value: pct(tt.recall), hint: t("drv.m.recall") },
    { label: "Brier", value: tt.brier.toFixed(3), hint: t("drv.m.brier") },
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid cols-2">
        <Card title={t("drv.global")} note={t("drv.global.note")}>
          <DriverBars data={drivers} maxItems={14} />
        </Card>
        <div className="grid" style={{ gap: 18, alignContent: "start" }}>
          <Card title={t("drv.perf")} note={t("drv.perf.note", { model: m.selected_model, n: tt.n })}>
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
              {t("drv.calib", { calib: m.calibration, rows: m.dataset.rows.toLocaleString(), feat: m.dataset.features })}
            </div>
          </Card>
          <Card title={t("drv.select")} note={t("drv.select.note")}>
            <div className="stacklist">
              {m.leaderboard.map((l) => (
                <div key={l.model} className="spread" style={{ padding: "9px 0", borderBottom: "1px solid var(--ring)" }}>
                  <span style={{ fontSize: 13.5, fontWeight: l.model === m.selected_model ? 700 : 550 }}>
                    {l.model}{l.model === m.selected_model && <span className="band Low" style={{ marginInlineStart: 8 }}>{t("drv.selected")}</span>}
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
