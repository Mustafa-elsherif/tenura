import { useState } from "react";
import * as api from "./api";
import { useI18n } from "./i18n";
import { Card, BandBadge } from "./ui";
import { pct } from "./charts";
import { IconUpload, IconDownload } from "./icons";
import type { Band } from "./types";
import type { BatchRow } from "./api";

export default function Batch() {
  const { t } = useI18n();
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (file: File) => {
    setBusy(true); setError(""); setName(file.name);
    try {
      const res = await api.predictBatch(file);
      setRows(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("batch.err"));
      setRows(null);
    } finally { setBusy(false); }
  };

  const loadSample = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}sample_employees.csv`);
      const blob = await r.blob();
      await run(new File([blob], "sample_employees.csv"));
    } catch { setError(t("batch.err")); setBusy(false); }
  };

  const download = () => {
    if (!rows) return;
    const csv = ["employee_id,risk_score,risk_band",
      ...rows.map((r) => `${r.id},${r.risk_score},${r.risk_band}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "tenura_scored.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const summary = rows ? {
    total: rows.length,
    high: rows.filter((r) => r.risk_band === "High" || r.risk_band === "Critical").length,
  } : null;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <Card title={t("batch.title")} note={t("batch.note")}>
        <label className="card" htmlFor="csv" style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 34,
          borderStyle: "dashed", cursor: "pointer", background: "var(--brand-050)", borderColor: "var(--glass-border)",
        }}>
          <div className="kpi-ico v1" style={{ width: 48, height: 48 }}><IconUpload /></div>
          <div style={{ fontWeight: 650 }}>{busy ? t("batch.scoring") : t("batch.drop")}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{name || t("batch.privacy")}</div>
          <input id="csv" type="file" accept=".csv" hidden
            onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
        </label>
        <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
          <button className="btn ghost" onClick={loadSample} disabled={busy}>{t("batch.sample")}</button>
          {rows && <button className="btn" onClick={download}><IconDownload size={17} /> {t("batch.download")}</button>}
        </div>
        {error && <div className="driver-action" style={{ color: "var(--critical)", marginTop: 12 }}>⚠ {error}</div>}
      </Card>

      {summary && (
        <Card title={t("batch.results")} note={t("batch.results.note", { n: summary.total.toLocaleString(), h: summary.high.toLocaleString() })}>
          <div className="table-wrap" style={{ maxHeight: 460, overflowY: "auto" }}>
            <table className="data">
              <thead><tr><th className="num">{t("batch.col.id")}</th><th className="num">{t("batch.col.risk")}</th><th>{t("emp.col.band")}</th></tr></thead>
              <tbody>
                {rows!.slice(0, 200).map((r) => (
                  <tr key={r.row}>
                    <td className="num">{r.id}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{pct(r.risk_score)}</td>
                    <td><BandBadge band={r.risk_band as Band} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows!.length > 200 && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{t("batch.showing", { n: rows!.length.toLocaleString() })}</div>}
        </Card>
      )}
    </div>
  );
}
