import { useMemo, useState } from "react";
import * as api from "./api";
import { Card, BandBadge, EmployeeDrawer } from "./ui";
import { money, pct } from "./charts";
import type { Band, Employee } from "./types";

const BANDS: Band[] = ["Critical", "High", "Moderate", "Low"];
const PAGE = 12;

const COLUMNS: { key: keyof Employee; label: string; num?: boolean }[] = [
  { key: "id", label: "ID", num: true },
  { key: "job_role", label: "Role" },
  { key: "department", label: "Department" },
  { key: "monthly_income", label: "Income", num: true },
  { key: "years_at_company", label: "Tenure", num: true },
  { key: "overtime", label: "Overtime" },
  { key: "risk_score", label: "Risk", num: true },
];

export default function Employees() {
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
    <Card title="Employee risk register" note={`${result.total.toLocaleString()} employees match · click a row for drivers & retention action`}>
      <div className="row" style={{ marginBottom: 14, gap: 10 }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Search role, department or ID…"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} aria-label="Search employees" />
        <select className="select" style={{ maxWidth: 190 }} value={dept} onChange={(e) => { setDept(e.target.value); setPage(0); }} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 150 }} value={overtime} onChange={(e) => { setOvertime(e.target.value); setPage(0); }} aria-label="Filter by overtime">
          <option value="">Overtime: any</option>
          <option value="Yes">Overtime: yes</option>
          <option value="No">Overtime: no</option>
        </select>
        <div className="row" style={{ gap: 6 }}>
          {BANDS.map((b) => (
            <button key={b} className={`chip ${bands.has(b) ? "active" : ""}`} onClick={() => toggleBand(b)} aria-pressed={bands.has(b)}>{b}</button>
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
                  {c.label}{sortBy === c.key && <span className="sort-ind">{order === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
              <th>Band</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((e) => (
              <tr key={e.id} onClick={() => setSelected(e)} tabIndex={0}
                onKeyDown={(ev) => ev.key === "Enter" && setSelected(e)}>
                <td className="num">{e.id}</td>
                <td>{e.job_role}</td>
                <td>{e.department}</td>
                <td className="num">{money(e.monthly_income)}</td>
                <td className="num">{e.years_at_company}y</td>
                <td>{e.overtime}</td>
                <td className="num" style={{ fontWeight: 700 }}>{pct(e.risk_score)}</td>
                <td><BandBadge band={e.risk_band} /></td>
              </tr>
            ))}
            {!result.items.length && <tr><td colSpan={8} className="empty">No employees match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button className="btn ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {selected && <EmployeeDrawer emp={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
}
