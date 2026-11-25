import { useState } from "react";

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

/* Horizontal magnitude bars — one measure, one sequential hue, direct labels. */
export function RiskByDepartment({
  data,
}: {
  data: { name: string; avg_risk: number; headcount: number; high_risk: number; actual_attrition: number }[];
}) {
  const { setTip, node } = useTip();
  const max = Math.max(...data.map((d) => d.avg_risk), 0.01);
  return (
    <div onMouseLeave={() => setTip(null)}>
      <div className="stacklist" style={{ gap: 14 }}>
        {data.map((d) => {
          const w = (d.avg_risk / max) * 100;
          return (
            <div key={d.name}
              onMouseMove={(e) =>
                setTip({
                  x: e.clientX, y: e.clientY,
                  html: (<><b>{d.name}</b><div>Avg risk {pct(d.avg_risk)}</div><div>{d.high_risk} high-risk of {d.headcount}</div><div>Actual attrition {pct(d.actual_attrition)}</div></>),
                })
              }>
              <div className="spread" style={{ marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{pct(d.avg_risk)}</span>
              </div>
              <div style={{ height: 11, borderRadius: 999, background: "var(--grid)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${w}%`, minWidth: 6, borderRadius: 999, background: "linear-gradient(90deg,var(--series-1),var(--series-2))" }} />
              </div>
            </div>
          );
        })}
      </div>
      {node}
    </div>
  );
}

const BAND_COLOR: Record<string, string> = {
  Low: "var(--low)", Moderate: "var(--moderate)", High: "var(--high)", Critical: "var(--critical)",
};

/* Donut — parts of whole by status band; legend + center total. */
export function BandDonut({ data, total }: { data: { name: string; headcount: number }[]; total: number }) {
  const { setTip, node } = useTip();
  const R = 78, r = 50, C = 2 * Math.PI * ((R + r) / 2), sw = R - r;
  let acc = 0;
  const sum = data.reduce((s, d) => s + d.headcount, 0) || 1;
  return (
    <div className="row" style={{ gap: 22, alignItems: "center", justifyContent: "center" }} onMouseLeave={() => setTip(null)}>
      <svg width={180} height={180} viewBox="0 0 180 180" role="img" aria-label="Risk band distribution">
        <g transform="translate(90,90) rotate(-90)">
          {data.map((d) => {
            const frac = d.headcount / sum;
            const len = frac * C;
            const el = (
              <circle key={d.name} r={(R + r) / 2} fill="none"
                stroke={BAND_COLOR[d.name]} strokeWidth={sw}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc}
                style={{ transition: "stroke-width .15s" }}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, html: (<><b>{d.name}</b><div>{d.headcount} employees ({pct(d.headcount / sum)})</div></>) })}
              />
            );
            acc += len;
            return el;
          })}
        </g>
        <text x="90" y="84" textAnchor="middle" style={{ fontSize: 30, fontWeight: 780, fill: "var(--text)" }}>{total.toLocaleString()}</text>
        <text x="90" y="104" textAnchor="middle" style={{ fontSize: 12, fill: "var(--text-3)" }}>employees</text>
      </svg>
      <div className="stacklist" style={{ gap: 9 }}>
        {data.map((d) => (
          <div key={d.name} className="spread" style={{ gap: 16, minWidth: 150 }}>
            <span style={{ fontSize: 13 }}><span className="sw" style={{ background: BAND_COLOR[d.name] }} />{d.name}</span>
            <span style={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{d.headcount}</span>
          </div>
        ))}
      </div>
      {node}
    </div>
  );
}

/* Global driver importance — horizontal magnitude bars, sequential hue. */
export function DriverBars({ data, maxItems = 8 }: { data: { label: string; importance: number }[]; maxItems?: number }) {
  const { setTip, node } = useTip();
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map((d) => d.importance), 0.001);
  return (
    <div className="stacklist" style={{ gap: 12 }} onMouseLeave={() => setTip(null)}>
      {items.map((d) => (
        <div key={d.label}
          onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, html: (<><b>{d.label}</b><div>Mean |SHAP| {d.importance.toFixed(3)}</div></>) })}>
          <div className="spread" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 550 }}>{d.label}</span>
          </div>
          <div style={{ height: 9, borderRadius: 999, background: "var(--grid)", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${(d.importance / max) * 100}%`, minWidth: 6, borderRadius: 999, background: "linear-gradient(90deg,var(--series-2),var(--series-1))" }} />
          </div>
        </div>
      ))}
      {node}
    </div>
  );
}

export { money, pct };
