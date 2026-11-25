import * as api from "./api";
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
  const m = api.metrics();
  const seg = api.segments();
  const drivers = api.drivers();
  const o = m.overview;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="grid kpi-row">
        <Kpi icon={<IconUsers />} variant="v1" label="Total headcount" value={o.headcount.toLocaleString()} sub={m.dataset.name} />
        <Kpi icon={<IconAlert />} variant="v2" label="High & critical risk" value={o.high_risk_count.toLocaleString()} sub={`${o.critical_count} critical · ${pct(o.high_risk_count / o.headcount)} of staff`} />
        <Kpi icon={<IconPulse />} variant="v3" label="Actual attrition rate" value={pct(m.dataset.positive_rate)} sub="Observed in source data" />
        <Kpi icon={<IconGauge />} variant="v4" label="Average risk score" value={pct(o.avg_risk_score)} sub="Model-estimated, calibrated" />
      </div>

      <div className="grid cols-2">
        <Card title="Attrition risk by department" note="Average calibrated risk score · hover for detail">
          <RiskByDepartment data={seg.by_department} />
        </Card>
        <Card title="Risk band distribution" note="Employees grouped by risk tier">
          <BandDonut data={seg.by_band} total={o.headcount} />
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="What drives attrition" note="Global SHAP importance across the workforce"
          right={<button className="chip" onClick={onExplore}>Explore drivers</button>}>
          <DriverBars data={drivers} maxItems={8} />
        </Card>
        <Card title="Highest-risk segments" note="Where to focus retention effort first">
          <div className="stacklist" style={{ gap: 2 }}>
            {seg.by_job_role.slice(0, 6).map((r) => (
              <div key={r.name} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--ring)" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.headcount} employees · {r.high_risk} high-risk</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 720, color: "var(--series-2)" }}>{pct(r.avg_risk)}</div>
                  <div className="muted" style={{ fontSize: 11 }}>avg risk</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
