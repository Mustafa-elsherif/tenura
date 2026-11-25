import { useEffect, useState } from "react";
import * as api from "./api";
import Overview from "./Overview";
import Employees from "./Employees";
import Drivers from "./Drivers";
import Predict from "./Predict";
import Batch from "./Batch";
import {
  IconGrid, IconUsers, IconChart, IconTarget, IconUpload,
  IconSun, IconMoon, IconMenu,
} from "./icons";

type Tab = "overview" | "employees" | "drivers" | "predict" | "batch";

const NAV: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: "overview", label: "Overview", icon: <IconGrid /> },
  { id: "employees", label: "Employees", icon: <IconUsers /> },
  { id: "drivers", label: "Drivers & model", icon: <IconChart /> },
  { id: "predict", label: "What-if predictor", icon: <IconTarget /> },
  { id: "batch", label: "Batch scoring", icon: <IconUpload /> },
];

const TITLES: Record<Tab, { h1: string; sub: string }> = {
  overview: { h1: "Workforce overview", sub: "Attrition risk across the organisation at a glance" },
  employees: { h1: "Employee register", sub: "Find, filter and investigate individual flight risk" },
  drivers: { h1: "Drivers & model", sub: "What moves attrition risk, and how the model performs" },
  predict: { h1: "What-if predictor", sub: "Estimate attrition risk for any employee profile" },
  batch: { h1: "Batch scoring", sub: "Score a whole CSV of employees in one pass" },
};

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const s = localStorage.getItem("tenura-theme");
      if (s === "light" || s === "dark") return s;
    } catch { /* ignore */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("tenura-theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")) };
}

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    api.init().then((r) => { setLive(r.live); setReady(true); }).catch(() => setReady(true));
  }, []);

  const go = (t: Tab) => { setTab(t); setNavOpen(false); };

  return (
    <div className="app">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 18 L9 11 L13 14 L20 5" /><circle cx="20" cy="5" r="1.4" fill="#fff" stroke="none" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Tenura</div>
            <div className="brand-sub">Workforce Risk Intelligence</div>
          </div>
        </div>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => go(n.id)} aria-current={tab === n.id ? "page" : undefined}>
              <span className="nav-ico">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Predictive attrition & retention analytics.<br />Built on the IBM HR dataset.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><IconMenu /></button>
          <div>
            <h1>{TITLES[tab].h1}</h1>
            <div className="subtitle">{TITLES[tab].sub}</div>
          </div>
          <div className="topbar-right">
            <span className="source-badge" title={live ? "Connected to the live FastAPI backend" : "Running on the bundled dataset and in-browser model"}>
              <span className={`dot ${live ? "live" : ""}`} />{live ? "Live API" : "Live demo data"}
            </span>
            <button className="icon-btn" onClick={toggle} aria-label="Toggle colour theme">
              {theme === "light" ? <IconMoon /> : <IconSun />}
            </button>
          </div>
        </header>

        {!ready ? (
          <div className="grid kpi-row">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 118 }} />)}
          </div>
        ) : (
          <>
            {tab === "overview" && <Overview onExplore={() => setTab("drivers")} />}
            {tab === "employees" && <Employees />}
            {tab === "drivers" && <Drivers />}
            {tab === "predict" && <Predict />}
            {tab === "batch" && <Batch />}
          </>
        )}
      </main>
    </div>
  );
}
