import { useMemo, useState } from "react";
import * as api from "./api";
import { useI18n } from "./i18n";
import { Card, BandBadge, EmployeeDrawer } from "./ui";
import { money, pct } from "./charts";
import type { Band, Employee } from "./types";

const BANDS: Band[] = ["Critical", "High", "Moderate", "Low"];
const PAGE = 12;

const COLUMNS: { key: keyof Employee; label: string; num?: boolean }[] = [
  { key: "id", label: "emp.col.id", num: true },
  { key: "job_role", label: "emp.col.role" },
  { key: "department", label: "emp.col.dept" },
  { key: "monthly_income", label: "emp.col.income", num: true },
  { key: "years_at_company", label: "emp.col.tenure", num: true },
  { key: "overtime", label: "emp.col.ot" },
  { key: "risk_score", label: "emp.col.risk", num: true },
];

export default function Employees() {
  const { t, value } = useI18n();
  const [bands, setBands] = useState<Set<Band>>(new Set());
  const [dept, setDept] = useState("");
  const [overtime, setOvertime] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("risk_score");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Employee | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(api.allEmployees().map((e) => e.department))).sort(), []
  );

  const result = api.queryEmployees({
    department: dept || undefined,
    overtime: overtime || undefined,
    risk_band: bands.size ? Array.from(bands).join(",") : undefined,
    search: search || undefined,
    sort_by: sortBy, order, limit: PAGE, offset: page * PAGE,
  });

  const toggleBand = (b: Band) => {
    const n = new Set(bands);
    n.has(b) ? n.delete(b) : n.add(b);
    setBands(n); setPage(0);
  };
  const sort = (key: string) => {
    if (sortBy === key) setOrder(order === "asc" ? "desc" : "asc");
    else { setSortBy(key); setOrder("desc"); }
    setPage(0);
  };

  const pages = Math.ceil(result.total / PAGE);

  return (
    <Card title={t("emp.title")} note={t("emp.note", { n: result.total.toLocaleString() })}>
      <div className="row" style={{ marginBottom: 14, gap: 10 }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder={t("emp.search")}
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} aria-label={t("emp.search")} />
        <select className="select" style={{ maxWidth: 190 }} value={dept} onChange={(e) => { setDept(e.target.value); setPage(0); }} aria-label={t("emp.allDepts")}>
          <option value="">{t("emp.allDepts")}</option>
          {departments.map((d) => <option key={d} value={d}>{value(d)}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 160 }} value={overtime} onChange={(e) => { setOvertime(e.target.value); setPage(0); }} aria-label={t("emp.otAny")}>
          <option value="">{t("emp.otAny")}</option>
          <option value="Yes">{t("emp.otYes")}</option>
          <option value="No">{t("emp.otNo")}</option>
        </select>
        <div className="row" style={{ gap: 6 }}>
          {BANDS.map((b) => (
            <button key={b} className={`chip ${bands.has(b) ? "active" : ""}`} onClick={() => toggleBand(b)} aria-pressed={bands.has(b)}>{t(`band.${b}`)}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.num ? "num" : ""} onClick={() => sort(c.key)}
                  aria-sort={sortBy === c.key ? (order === "asc" ? "ascending" : "descending") : "none"}>
                  {t(c.label)}{sortBy === c.key && <span className="sort-ind">{order === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
              <th>{t("emp.col.band")}</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((e) => (
              <tr key={e.id} onClick={() => setSelected(e)} tabIndex={0}
                onKeyDown={(ev) => ev.key === "Enter" && setSelected(e)}>
                <td className="num">{e.id}</td>
                <td>{value(e.job_role)}</td>
                <td>{value(e.department)}</td>
                <td className="num">{money(e.monthly_income)}</td>
                <td className="num">{t("drawer.years", { n: e.years_at_company })}</td>
                <td>{value(e.overtime)}</td>
                <td className="num" style={{ fontWeight: 700 }}>{pct(e.risk_score)}</td>
                <td><BandBadge band={e.risk_band} /></td>
              </tr>
            ))}
            {!result.items.length && <tr><td colSpan={8} className="empty">{t("emp.empty")}</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("pager.prev")}</button>
          <span>{t("pager.page", { p: page + 1, t: pages })}</span>
          <button className="btn ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t("pager.next")}</button>
        </div>
      )}

      {selected && <EmployeeDrawer emp={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}
