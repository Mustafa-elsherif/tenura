import type { ReactNode } from "react";
import type { Band, Driver, Employee } from "./types";
import { IconClose } from "./icons";
import { money, pct } from "./charts";

export function Card({ title, note, right, children, style }: {
  title?: string; note?: string; right?: ReactNode; children: ReactNode; style?: React.CSSProperties;
}) {
  return (
    <section className="card" style={style}>
      {(title || right) && (
        <div className="card-head">
          <div>
            {title && <div className="card-title">{title}</div>}
            {note && <div className="card-note">{note}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function BandBadge({ band }: { band: Band }) {
  return <span className={`band ${band}`}>{band}</span>;
}

const BAND_VAR: Record<Band, string> = {
  Low: "var(--low)", Moderate: "var(--moderate)", High: "var(--high)", Critical: "var(--critical)",
};

export function RiskMeter({ score, band }: { score: number; band: Band }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="spread">
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em" }}>{pct(score)}</span>
        <BandBadge band={band} />
      </div>
      <div className="meter"><span style={{ width: `${Math.max(score * 100, 3)}%`, background: BAND_VAR[band] }} /></div>
      <div className="muted" style={{ fontSize: 12 }}>Estimated probability of attrition</div>
    </div>
  );
}

export function DriverList({ drivers }: { drivers: Driver[] }) {
  const max = Math.max(...drivers.map((d) => Math.abs(d.impact)), 0.001);
  return (
    <div>
      {drivers.map((d) => {
        const w = (Math.abs(d.impact) / max) * 100;
        const up = d.direction === "increases";
        return (
          <div className="driver" key={d.feature + d.label}>
            <div className="driver-head">
              <span className="driver-name">{d.label}</span>
              <span className={up ? "tag-up" : "tag-down"}>{up ? "▲ raises risk" : "▼ lowers risk"}</span>
            </div>
            <div className="driver-bar">
              <span style={{ width: `${w}%`, background: up ? "var(--critical)" : "var(--low)", left: 0 }} />
            </div>
            {d.action && <div className="driver-action">↳ {d.action}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function EmployeeDrawer({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const narrative = buildNarrative(emp);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Employee ${emp.id} risk detail`}>
        <div className="spread" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>EMPLOYEE #{emp.id}</div>
            <div style={{ fontSize: 19, fontWeight: 740, letterSpacing: "-0.02em" }}>{emp.job_role}</div>
            <div className="muted" style={{ fontSize: 13 }}>{emp.department} · Level {emp.job_level}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </div>

        <RiskMeter score={emp.risk_score} band={emp.risk_band} />

        <div className="sep" />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Mini label="Monthly income" value={money(emp.monthly_income)} />
          <Mini label="Tenure" value={`${emp.years_at_company} yrs`} />
          <Mini label="Overtime" value={emp.overtime} />
          <Mini label="Job satisfaction" value={`${emp.job_satisfaction} / 4`} />
          <Mini label="Work-life balance" value={`${emp.work_life_balance} / 4`} />
          <Mini label="Since promotion" value={`${emp.years_since_promotion} yrs`} />
        </div>

        <div className="sep" />
        <div className="card-title" style={{ marginBottom: 6 }}>Why this risk</div>
        <p className="driver-action" style={{ marginTop: 0, marginBottom: 10 }}>{narrative}</p>
        <DriverList drivers={emp.top_drivers} />
      </aside>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="metric-mini"><b>{value}</b><span>{label}</span></div>;
}

function buildNarrative(emp: Employee): string {
  const raisers = emp.top_drivers.filter((d) => d.direction === "increases").slice(0, 2).map((d) => d.label.toLowerCase());
  const band = emp.risk_band.toLowerCase();
  if (!raisers.length) return `This employee is ${band} risk, with no single factor standing out.`;
  const first = emp.top_drivers.find((d) => d.direction === "increases" && d.action);
  const lead = `This ${emp.job_role} in ${emp.department} is ${band} risk, driven mainly by ${raisers.join(" and ")}.`;
  return first?.action ? `${lead} ${first.action}` : lead;
}
