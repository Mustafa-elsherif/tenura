import * as api from "./api";
import { useI18n } from "./i18n";
import { Card } from "./ui";
import { RiskByDepartment, BandDonut, DriverBars, pct } from "./charts";
import { IconUsers, IconAlert, IconPulse, IconGauge } from "./icons";
import type { ReactNode } from "react";

function Kpi({ icon, variant, label, value, sub }: {
  icon: ReactNode; variant: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className={`kpi-ico ${variant}`}>{icon}</div>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

export default function Overview({ onExplore }: { onExplore: () => void }) {
  const { t, value } = useI18n();
  const m = api.metrics();
  const seg = api.segments();
  const drivers = api.drivers();
  const o = m.overview;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid kpi-row">
        <Kpi icon={<IconUsers />} variant="v1" label={t("kpi.headcount")} value={o.headcount.toLocaleString()} sub={t("kpi.headcount.sub")} />
        <Kpi icon={<IconAlert />} variant="v2" label={t("kpi.highrisk")} value={o.high_risk_count.toLocaleString()} sub={t("kpi.highrisk.sub", { crit: o.critical_count, pct: pct(o.high_risk_count / o.headcount) })} />
        <Kpi icon={<IconPulse />} variant="v3" label={t("kpi.attrition")} value={pct(m.dataset.positive_rate)} sub={t("kpi.attrition.sub")} />
        <Kpi icon={<IconGauge />} variant="v4" label={t("kpi.avgrisk")} value={pct(o.avg_risk_score)} sub={t("kpi.avgrisk.sub")} />
      </div>

      <div className="grid cols-2">
        <Card title={t("card.byDept")} note={t("card.byDept.note")}>
          <RiskByDepartment data={seg.by_department} />
        </Card>
        <Card title={t("card.bands")} note={t("card.bands.note")}>
          <BandDonut data={seg.by_band} total={o.headcount} />
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title={t("card.drivers")} note={t("card.drivers.note")}
          right={<button className="chip" onClick={onExplore}>{t("card.drivers.cta")}</button>}>
          <DriverBars data={drivers} maxItems={8} />
        </Card>
        <Card title={t("card.segments")} note={t("card.segments.note")}>
          <div className="stacklist" style={{ gap: 2 }}>
            {seg.by_job_role.slice(0, 6).map((r) => (
              <div key={r.name} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--ring)" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{value(r.name)}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{t("seg.line", { n: r.headcount, h: r.high_risk })}</div>
                </div>
                <div style={{ textAlign: "end" }}>
                  <div style={{ fontSize: 15, fontWeight: 720, color: "var(--series-2)" }}>{pct(r.avg_risk)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{t("seg.avg")}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
