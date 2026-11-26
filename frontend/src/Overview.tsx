import * as api from "./api";
import { useI18n } from "./i18n";
import { Card } from "./ui";
import { RiskByDepartment, RiskSpectrum, DriverBars, pct } from "./charts";

export default function Overview({ onExplore }: { onExplore: () => void }) {
  const { t, value } = useI18n();
  const m = api.metrics();
  const seg = api.segments();
  const drivers = api.drivers();
  const o = m.overview;

  const stats = [
    { label: t("stat.attrition"), value: pct(m.dataset.positive_rate), sub: t("stat.attrition.sub") },
    { label: t("stat.avgrisk"), value: pct(o.avg_risk_score), sub: t("stat.avgrisk.sub") },
    { label: t("stat.critical"), value: o.critical_count.toLocaleString(), sub: t("stat.critical.sub"), risk: true },
    { label: t("stat.share"), value: pct(o.high_risk_count / o.headcount), sub: t("stat.share.sub") },
  ];

  return (
    <div className="grid" style={{ gap: 18 }}>
      {/* Hero — the headline figure and the whole workforce as a risk spectrum */}
      <section className="hero">
        <div className="hero-top">
          <div className="hero-lede">
            <div className="hero-figure">{o.high_risk_count.toLocaleString()}</div>
            <div className="hero-lede-text">{t("hero.flagged")}</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 10, marginBottom: 0, lineHeight: 1.5, maxWidth: "40ch" }}>
              {t("hero.of", { n: o.headcount.toLocaleString(), c: o.critical_count.toLocaleString() })}
            </p>
          </div>
          <div className="hero-count">
            <b>{o.headcount.toLocaleString()}</b>
            <span>{t("hero.scored")}</span>
          </div>
        </div>
        <RiskSpectrum data={seg.by_band} total={o.headcount} />
      </section>

      {/* Stat band — complementary metrics, divided by hairlines, no boxes */}
      <div className="statband">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.risk ? "risk" : ""}`}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <Card title={t("card.byDept")} note={t("card.byDept.note")}>
        <RiskByDepartment data={seg.by_department} />
      </Card>

      <div className="grid cols-2e">
        <Card title={t("card.drivers")} note={t("card.drivers.note")}
          right={<button className="chip" onClick={onExplore}>{t("card.drivers.cta")}</button>}>
          <DriverBars data={drivers} maxItems={8} />
        </Card>
        <Card title={t("card.segments")} note={t("card.segments.note")}>
          <div className="stacklist">
            {seg.by_job_role.slice(0, 6).map((r) => (
              <div key={r.name} className="spread" style={{ padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{value(r.name)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t("seg.line", { n: r.headcount, h: r.high_risk })}</div>
                </div>
                <div style={{ textAlign: "end" }}>
                  <div style={{ fontFamily: "var(--font-exp)", fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pct(r.avg_risk)}</div>
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
