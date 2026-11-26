"""Grounded workforce assistant for the Tenura API.

Answers STRICTLY from the pre-computed artifacts. Uses Google Gemini when
GEMINI_API_KEY is set (called only from the backend — the key never reaches the
browser); otherwise falls back to a deterministic grounded retrieval engine so
the assistant always works, even with no key and no internet.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx

from .artifacts import Store
from .features import pretty_feature

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
# Models tried in order (first is the configured default). Keeps working as
# Google rotates versions; falls back to the deterministic engine if all fail.
GEMINI_MODELS = [GEMINI_MODEL, "gemini-flash-latest", "gemini-3.8-flash"]
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

FEATURE_AR = {
    "OverTime": "العمل الإضافي", "MonthlyIncome": "الدخل الشهري", "SatisfactionIndex": "الرضا العام",
    "StockOptionLevel": "خيارات الأسهم", "JobRole": "الدور الوظيفي", "YearsSinceLastPromotion": "سنوات منذ الترقية",
    "Age": "العمر", "DistanceFromHome": "مسافة التنقّل", "NumCompaniesWorked": "عدد جهات العمل السابقة",
    "MaritalStatus": "الحالة الاجتماعية", "BusinessTravel": "السفر للعمل",
}


def _feat(token: str, lang: str) -> str:
    if lang == "ar":
        return FEATURE_AR.get(token, pretty_feature(token))
    return pretty_feature(token)


def facts(store: Store) -> dict:
    """Compact, real figures the assistant is allowed to use."""
    m = store.metrics
    o = m["overview"]
    seg = store.segments
    return {
        "headcount": o["headcount"],
        "attrition_rate": m["dataset"]["positive_rate"],
        "high_risk_count": o["high_risk_count"],
        "critical_count": o["critical_count"],
        "avg_risk_score": o["avg_risk_score"],
        "selected_model": m["selected_model"],
        "test_roc_auc": m["test"]["roc_auc"],
        "test_pr_auc": m["test"]["pr_auc"],
        "test_brier": m["test"]["brier"],
        "top_drivers": [d["feature"] for d in store.feature_importance[:6]],
        "department_risk": {r["name"]: round(r["avg_risk"], 4) for r in seg["by_department"]},
        "role_risk": {r["name"]: round(r["avg_risk"], 4) for r in seg["by_job_role"][:6]},
    }


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def local_answer(message: str, lang: str, store: Store) -> dict:
    """Deterministic grounded fallback (no external calls)."""
    q = message.lower().strip()
    f = facts(store)
    ar = lang == "ar"

    def sug():
        return (
            [
                {"label": "معدّل ترك العمل الإجمالي", "query": "معدّل ترك العمل الإجمالي"},
                {"label": "أهم محرّكات ترك العمل", "query": "أهم محرّكات ترك العمل"},
                {"label": "القسم الأعلى مخاطرة", "query": "القسم الأعلى مخاطرة"},
            ] if ar else [
                {"label": "Overall attrition rate", "query": "Overall attrition rate"},
                {"label": "Top attrition drivers", "query": "Top attrition drivers"},
                {"label": "Riskiest department", "query": "Riskiest department"},
            ]
        )

    import re

    def has(*ws):
        return any(w in q for w in ws)

    # Employee lookup
    mnum = re.search(r"\b(\d{1,4})\b", message)
    if mnum and has("employee", "id", "موظف", "رقم", "معرف"):
        emp = store.employee(int(mnum.group(1)))
        if emp:
            ups = [d["label"] for d in emp["top_drivers"] if d["direction"] == "increases"][:2]
            if ar:
                return {"reply": f"الموظف رقم {emp['id']} ({emp['job_role']}) مخاطرته {_pct(emp['risk_score'])} — فئة {emp['risk_band']}. أبرز المحرّكات: {'، '.join(ups) or 'لا يوجد'}."}
            return {"reply": f"Employee #{emp['id']} ({emp['job_role']}) has {_pct(emp['risk_score'])} risk — {emp['risk_band']} band. Main drivers: {', '.join(ups) or 'none'}."}
        return {"reply": (f"لم أجد موظفاً بالمعرّف {mnum.group(1)}." if ar else f"No employee with ID {mnum.group(1)}.")}

    if re.search(r"\b(hi|hello|hey|help)\b", q) or has("مرحبا", "مساعدة", "اهلا", "أهلا", "السلام"):
        return {"reply": ("مرحباً! أنا أطلس. أجيب عن بيانات القوى العاملة — ترك العمل والمحرّكات والأقسام والموظفين."
                          if ar else "Hi! I'm Atlas. I answer questions about this workforce data — attrition, drivers, departments and employees."),
                "suggestions": sug()}

    if has("attrition rate", "turnover", "معدل", "ترك العمل", "دوران"):
        return {"reply": (f"معدّل ترك العمل الفعلي هو {_pct(f['attrition_rate'])} من {f['headcount']} موظف، ومتوسّط درجة المخاطرة {_pct(f['avg_risk_score'])}."
                          if ar else f"The actual attrition rate is {_pct(f['attrition_rate'])} of {f['headcount']} employees; the average risk score is {_pct(f['avg_risk_score'])}.")}

    if has("high risk", "high-risk", "critical", "how many", "مخاطرة", "مرتفع", "حرج", "كم"):
        return {"reply": (f"هناك {f['high_risk_count']} موظفاً بمخاطرة عالية أو حرجة، منهم {f['critical_count']} حرجة."
                          if ar else f"There are {f['high_risk_count']} employees at high or critical risk, of which {f['critical_count']} are critical.")}

    if has("driver", "why", "factor", "reason", "محرك", "محرّك", "سبب", "عامل", "لماذا"):
        names = [_feat(t, lang) for t in f["top_drivers"][:5]]
        return {"reply": (f"أهم محرّكات ترك العمل: {'، '.join(names)}."
                          if ar else f"The strongest attrition drivers are: {', '.join(names)}.")}

    if has("department", "dept", "قسم", "إدارة", "اقسام", "أقسام"):
        items = sorted(f["department_risk"].items(), key=lambda x: x[1], reverse=True)
        top = items[0]
        lst = ", ".join(f"{k} {_pct(v)}" for k, v in items)
        return {"reply": (f"الأعلى مخاطرة هو {top[0]} بمتوسّط {_pct(top[1])}. القائمة: {lst}."
                          if ar else f"The highest-risk department is {top[0]} at {_pct(top[1])}. Full list: {lst}.")}

    if has("role", "job", "segment", "دور", "وظيفة", "فئة"):
        items = list(f["role_risk"].items())[:4]
        lst = ", ".join(f"{k} {_pct(v)}" for k, v in items)
        return {"reply": (f"أعلى الأدوار مخاطرةً: {lst}." if ar else f"The riskiest roles are: {lst}.")}

    if has("model", "accuracy", "auc", "performance", "نموذج", "دقة", "أداء"):
        return {"reply": (f"النموذج {f['selected_model']} باحتمالات معايَرة: ROC-AUC {f['test_roc_auc']}، PR-AUC {f['test_pr_auc']}، براير {f['test_brier']}."
                          if ar else f"The model is {f['selected_model']} with calibrated probabilities: ROC-AUC {f['test_roc_auc']}, PR-AUC {f['test_pr_auc']}, Brier {f['test_brier']}.")}

    return {"reply": ("أركّز فقط على بيانات القوى العاملة في هذه المنصّة. اختر خياراً أدناه أو أعد صياغة سؤالك."
                      if ar else "I only cover this platform's workforce data. Pick an option below or rephrase within that scope."),
            "suggestions": sug()}


def _system_instruction(lang: str) -> str:
    return (
        "You are Atlas, the assistant embedded in the Tenura workforce-risk dashboard. "
        "Rules you must always follow:\n"
        "1. Only answer questions about this platform and its workforce data (employee attrition, "
        "risk scores and bands, SHAP drivers, departments, job roles, segments, and model metrics). "
        "Politely decline anything outside that scope or anything unsafe.\n"
        "2. Ground every factual claim in the DATA block provided with the user's message. "
        "NEVER invent or estimate numbers. If the data cannot answer, say so plainly.\n"
        "3. Keep answers concise (2-4 sentences) and professional.\n"
        f"4. Reply in the user's language. The current UI language is '{lang}'. If the user's message "
        "is clearly in another language, answer in that language instead.\n"
        "5. If the question is vague, ask one short clarifying question offering concrete choices."
    )


async def gemini_answer(message: str, lang: str, history: list, store: Store, api_key: str) -> Optional[str]:
    """Call Gemini. Returns the reply text, or None on any failure (→ fallback)."""
    contents = []
    for turn in history[-6:]:
        role = "user" if turn.get("role") == "user" else "model"
        text = str(turn.get("content", ""))[:1500]
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    grounded = f"DATA (the only figures you may use):\n{facts(store)}\n\nUser question: {message}"
    contents.append({"role": "user", "parts": [{"text": grounded}]})

    payload = {
        "systemInstruction": {"parts": [{"text": _system_instruction(lang)}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600, "topP": 0.9},
    }
    tried: set[str] = set()
    try:
        async with httpx.AsyncClient(timeout=14) as client:
            for model in GEMINI_MODELS:
                if model in tried:
                    continue
                tried.add(model)
                try:
                    r = await client.post(
                        GEMINI_URL.format(model=model), params={"key": api_key}, json=payload
                    )
                except Exception:  # noqa: BLE001
                    continue
                if r.status_code == 404:
                    continue  # model retired — try the next name
                if r.status_code != 200:
                    return None  # auth/quota/transient → graceful local fallback
                data = r.json()
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                return text or None
    except Exception:  # noqa: BLE001
        return None
    return None


async def chat(message: str, lang: str, history: list, store: Store) -> dict:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        reply = await gemini_answer(message, lang, history, store, key)
        if reply:
            return {"reply": reply, "mode": "gemini"}
    out = local_answer(message, lang, store)
    out["mode"] = "local"
    return out
