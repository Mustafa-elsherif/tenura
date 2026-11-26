import { useState } from "react";
import { useI18n } from "./i18n";

type Tip = { x: number; y: number; html: React.ReactNode } | null;

function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const node = tip ? (
    <div className="tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.html}</div>
  ) : null;
  return { setTip, node };
}

const money = (n: number) => `$${n.toLocaleString()}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const BAND_COLOR: Record<string, string> = {
  Low: "var(--low)", Moderate: "var(--moderate)", High: "var(--high)", Critical: "var(--critical)",
};
const BAND_ORDER = ["Low", "Moderate", "High", "Critical"];

/* Hero: the whole workforce laid across Low -> Critical as one proportional bar.
   This is the characteristic view of a risk product — colour means tier, nothing else. */
export function RiskSpectrum({ data, total }: { data: { name: string; headcount: number }[]; total: number }) {
  const { setTip, node } = useTip();
  const { t } = useI18n();
  const sorted = BAND_ORDER.map((n) => data.find((d) => d.name === n)).filter(Boolean) as { name: string; headcount: number }[];
  const sum = sorted.reduce((s, d) => s + d.headcount, 0) || 1;
  return (
    <div className="spectrum" onMouseLeave={() => setTip(null)}>
      <div className="spectrum-bar" role="img" aria-label={t("spectrum.aria", { n: total })}>
        {sorted.map((d) => {
          const frac = d.headcount / sum;
          return (
            <div key={d.name} className="spectrum-seg" style={{ flexGrow: d.headcount, background: BAND_COLOR[d.name] }}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, html: (<><b>{t(`band.${d.name}`)}</b><div>{d.headcount} ({pct(frac)})</div></>) })}>
              {frac > 0.06 && <span className="seg-count">{d.headcount.toLocaleString()}</span>}
            </div>
          );
        })}
      </div>
      <div className="spectrum-legend">
        {sorted.map((d) => (
          <span className="lg" key={d.name}>
            <span className="mk" style={{ background: BAND_COLOR[d.name] }} />
            {t(`band.${d.name}`)} <b>{d.headcount.toLocaleString()}</b>
            <span className="muted">{pct(d.headcount / sum)}</span>
          </span>
        ))}
      </div>
      {node}
    </div>
  );
}

/* Horizontal magnitude bars — one measure, one neutral graphite hue, direct labels. */
export function RiskByDepartment({
  data,
}: {
  data: { name: string; avg_risk: number; headcount: number; high_risk: number; actual_attrition: number }[];
}) {
  const { setTip, node } = useTip();
  const { t, value } = useI18n();
  const max = Math.max(...data.map((d) => d.avg_risk), 0.01);
  return (
    <div onMouseLeave={() => setTip(null)}>
      <div className="stacklist" style={{ gap: 15 }}>
        {data.map((d) => {
          const w = (d.avg_risk / max) * 100;
          return (
            <div key={d.name}
              onMouseMove={(e) =>
                setTip({
                  x: e.clientX, y: e.clientY,
                  html: (<><b>{value(d.name)}</b><div>{t("chart.avgRisk", { v: pct(d.avg_risk) })}</div><div>{t("chart.highOf", { h: d.high_risk, n: d.headcount })}</div><div>{t("chart.actual", { v: pct(d.actual_attrition) })}</div></>),
                })
              }>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{value(d.name)}</span>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{pct(d.avg_risk)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "var(--graph-track)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${w}%`, minWidth: 6, borderRadius: 999, background: "var(--graph)" }} />
              </div>
            </div>
          );
        })}
      </div>
      {node}
    </div>
  );
}

/* Global driver importance — horizontal magnitude bars, neutral graphite. */
export function DriverBars({ data, maxItems = 8 }: { data: { feature: string; label: string; importance: number }[]; maxItems?: number }) {
  const { setTip, node } = useTip();
  const { t, feature } = useI18n();
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map((d) => d.importance), 0.001);
  return (
    <div className="stacklist" style={{ gap: 13 }} onMouseLeave={() => setTip(null)}>
      {items.map((d) => (
        <div key={d.label}
          onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, html: (<><b>{feature(d.feature)}</b><div>{t("chart.shap", { v: d.importance.toFixed(3) })}</div></>) })}>
          <div className="spread" style={{ marginBottom: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{feature(d.feature)}</span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "var(--graph-track)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(d.importance / max) * 100}%`, minWidth: 6, borderRadius: 999, background: "var(--graph)" }} />
          </div>
        </div>
      ))}
      {node}
    </div>
  );
}

export { money, pct };
