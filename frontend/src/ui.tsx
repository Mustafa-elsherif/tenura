import type { ReactNode } from "react";
import type { Band, Driver, Employee } from "./types";
import { IconClose } from "./icons";
import { money, pct } from "./charts";
import { useI18n } from "./i18n";

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
  const { t } = useI18n();
  return <span className={`band ${band}`}>{t(`band.${band}`)}</span>;
}

const BAND_VAR: Record<Band, string> = {
  Low: "var(--low)", Moderate: "var(--moderate)", High: "var(--high)", Critical: "var(--critical)",
};

export function RiskMeter({ score, band }: { score: number; band: Band }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="spread">
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em" }}>{pct(score)}</span>
        <BandBadge band={band} />
      </div>
      <div className="meter"><span style={{ width: `${Math.max(score * 100, 3)}%`, background: BAND_VAR[band] }} /></div>
      <div className="muted" style={{ fontSize: 12 }}>{t("drawer.prob")}</div>
    </div>
  );
}

export function DriverList({ drivers }: { drivers: Driver[] }) {
  const i18n = useI18n();
  const max = Math.max(...drivers.map((d) => Math.abs(d.impact)), 0.001);
  return (
    <div>
      {drivers.map((d) => {
        const w = (Math.abs(d.impact) / max) * 100;
        const up = d.direction === "increases";
        const loc = i18n.localizeDriver(d);
        return (
          <div className="driver" key={d.feature + d.label}>
            <div className="driver-head">
              <span className="driver-name">{loc.label}</span>
              <span className={up ? "tag-up" : "tag-down"}>{up ? i18n.t("driver.up") : i18n.t("driver.down")}</span>
            </div>
            <div className="driver-bar">
              <span style={{ width: `${w}%`, background: up ? "var(--critical)" : "var(--low)" }} />
            </div>
            {loc.action && <div className="driver-action">↳ {loc.action}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function EmployeeDrawer({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const { t, value } = useI18n();
  const i18n = useI18n();
  const narrative = buildNarrative(emp, i18n);
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={t("drawer.employee", { id: emp.id })}>
        <div className="spread" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{t("drawer.employee", { id: emp.id })}</div>
            <div style={{ fontSize: 19, fontWeight: 740, letterSpacing: "-0.02em" }}>{value(emp.job_role)}</div>
            <div className="muted" style={{ fontSize: 13 }}>{t("drawer.deptLevel", { dept: value(emp.department), lvl: emp.job_level })}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("a11y.close")}><IconClose /></button>
        </div>

        <RiskMeter score={emp.risk_score} band={emp.risk_band} />

        <div className="sep" />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Mini label={t("drawer.income")} value={money(emp.monthly_income)} />
          <Mini label={t("drawer.tenure")} value={t("drawer.years", { n: emp.years_at_company })} />
          <Mini label={t("drawer.ot")} value={value(emp.overtime)} />
          <Mini label={t("drawer.jobsat")} value={`${emp.job_satisfaction} / 4`} />
          <Mini label={t("drawer.wlb")} value={`${emp.work_life_balance} / 4`} />
          <Mini label={t("drawer.promo")} value={t("drawer.years", { n: emp.years_since_promotion })} />
        </div>

        <div className="sep" />
        <div className="card-title" style={{ marginBottom: 6 }}>{t("drawer.why")}</div>
        <p className="driver-action" style={{ marginTop: 0, marginBottom: 10 }}>{narrative}</p>
        <DriverList drivers={emp.top_drivers} />
      </aside>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="metric-mini"><b>{value}</b><span>{label}</span></div>;
}

function buildNarrative(emp: Employee, i18n: ReturnType<typeof useI18n>): string {
  const { t, value, lang } = i18n;
  const raisers = emp.top_drivers.filter((d) => d.direction === "increases").slice(0, 2)
    .map((d) => i18n.localizeDriver(d).label);
  const bandTxt = t(`band.${emp.risk_band}`);
  const first = emp.top_drivers.find((d) => d.direction === "increases" && d.action);
  const action = first ? i18n.localizeDriver(first).action : null;
  if (lang === "ar") {
    if (!raisers.length) return `هذا الموظف ذو مخاطرة ${bandTxt}، دون عامل بارز واحد.`;
    const lead = `هذا ${value(emp.job_role)} في ${value(emp.department)} ذو مخاطرة ${bandTxt}، مدفوعة أساساً بـ ${raisers.join(" و")}.`;
    return action ? `${lead} ${action}` : lead;
  }
  if (!raisers.length) return `This employee is ${bandTxt.toLowerCase()} risk, with no single factor standing out.`;
  const lead = `This ${emp.job_role} in ${emp.department} is ${bandTxt.toLowerCase()} risk, driven mainly by ${raisers.map((r) => r.toLowerCase()).join(" and ")}.`;
  return action ? `${lead} ${action}` : lead;
}
