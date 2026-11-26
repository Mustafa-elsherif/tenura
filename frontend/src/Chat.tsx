import { useEffect, useRef, useState } from "react";
import * as api from "./api";
import { useI18n } from "./i18n";
import { answer, suggestionsFor, type Suggestion } from "./assistant";
import { IconClose } from "./icons";

interface Msg { role: "user" | "assistant"; content: string; suggestions?: Suggestion[]; }

export default function Chat() {
  const i18n = useI18n();
  const { t, dir } = i18n;
  const [open, setOpen] = useState(() => {
    try { return window.location.hash === "#assistant"; } catch { return false; }
  });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Seed / reset the greeting whenever the language changes.
  useEffect(() => {
    setMsgs([{ role: "assistant", content: t("chat.greeting"), suggestions: suggestionsFor(t) }]);
  }, [i18n.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      if (api.isLive()) {
        const history = msgs.map((m) => ({ role: m.role, content: m.content }));
        const res = await api.chatRemote(message, i18n.lang, history);
        setMsgs((m) => [...m, { role: "assistant", content: res.reply, suggestions: res.suggestions }]);
      } else {
        // On-device grounded retrieval (live demo, no backend).
        await new Promise((r) => setTimeout(r, 280));
        const res = answer(message, i18n);
        setMsgs((m) => [...m, { role: "assistant", content: res.text, suggestions: res.suggestions }]);
      }
    } catch {
      const res = answer(message, i18n);
      setMsgs((m) => [...m, { role: "assistant", content: res.text, suggestions: res.suggestions }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={`chat-fab ${open ? "hidden" : ""}`} onClick={() => setOpen(true)} aria-label={t("chat.open")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.6L3 21l1.9-5.8A8.5 8.5 0 1 1 21 11.5Z" />
        </svg>
        <span>{t("chat.fab")}</span>
      </button>

      {open && (
        <section className="chat-panel" role="dialog" aria-label={t("chat.title")} dir={dir}>
          <header className="chat-head">
            <div className="chat-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4Z" /><path d="M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="chat-title">{t("chat.title")}</div>
              <div className="chat-sub">{api.isLive() ? t("chat.poweredGemini") : t("chat.poweredLocal")}</div>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t("a11y.close")}><IconClose size={18} /></button>
          </header>

          <div className="chat-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role}`}>
                <div className={`bubble ${m.role}`}>{m.content}</div>
                {m.suggestions && i === msgs.length - 1 && !busy && (
                  <div className="chat-suggest">
                    {m.suggestions.map((s) => (
                      <button key={s.query} className="chip" onClick={() => send(s.query)}>{s.label}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble-row assistant">
                <div className="bubble assistant typing"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input className="input" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder")} aria-label={t("chat.placeholder")} />
            <button className="btn" type="submit" disabled={busy || !input.trim()} aria-label={t("chat.send")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}
