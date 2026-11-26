import { useEffect, useState } from "react";
import * as api from "./api";
import { useI18n } from "./i18n";
import Overview from "./Overview";
import Employees from "./Employees";
import Drivers from "./Drivers";
import Predict from "./Predict";
import Batch from "./Batch";
import Chat from "./Chat";
import {
  IconGrid, IconUsers, IconChart, IconTarget, IconUpload,
  IconSun, IconMoon, IconMenu,
} from "./icons";

type Tab = "overview" | "employees" | "drivers" | "predict" | "batch";

const NAV: { id: Tab; key: string; icon: JSX.Element }[] = [
  { id: "overview", key: "nav.overview", icon: <IconGrid /> },
  { id: "employees", key: "nav.employees", icon: <IconUsers /> },
  { id: "drivers", key: "nav.drivers", icon: <IconChart /> },
  { id: "predict", key: "nav.predict", icon: <IconTarget /> },
  { id: "batch", key: "nav.batch", icon: <IconUpload /> },
];

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
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    api.init().then((r) => { setLive(r.live); setReady(true); }).catch(() => setReady(true));
  }, []);

  const go = (tb: Tab) => { setTab(tb); setNavOpen(false); };

  return (
    <div className="app">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="23" height="23" viewBox="0 0 32 32">
              <rect x="6" y="10" width="20" height="3.6" rx="1.3" fill="var(--on-accent)" />
              <rect x="14.2" y="10" width="3.6" height="14.6" rx="1.3" fill="var(--on-accent)" />
              <circle cx="25" cy="6.2" r="2.6" fill="var(--critical)" />
            </svg>
          </div>
          <div className="brand-text">
            <div className="brand-name">Tenura</div>
            <div className="brand-sub">{t("brand.sub")}</div>
          </div>
        </div>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => go(n.id)} aria-current={tab === n.id ? "page" : undefined}>
              <span className="nav-ico">{n.icon}</span>{t(n.key)}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="foot-label">{t("sidebar.foot.label")}</span>
          <span className="foot-text">{t("sidebar.foot")}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label={t("a11y.menu")}><IconMenu /></button>
          <div className="topbar-heading">
            <h1>{t(`title.${tab}.h1`)}</h1>
            <div className="subtitle">{t(`title.${tab}.sub`)}</div>
          </div>
          <div className="topbar-right">
            <span className="source-badge" title={live ? t("badge.live.tip") : t("badge.demo.tip")}>
              <span className={`dot ${live ? "live" : ""}`} />{live ? t("badge.live") : t("badge.demo")}
            </span>
            <div className="lang-switch" role="group" aria-label={t("a11y.lang")}>
              <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button>
              <button className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")} aria-pressed={lang === "ar"}>عربي</button>
            </div>
            <button className="icon-btn" onClick={toggle} aria-label={t("a11y.theme")}>
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

      {ready && <Chat />}
    </div>
  );
}
