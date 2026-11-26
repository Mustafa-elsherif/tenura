// Grounded, on-device workforce assistant. Answers STRICTLY from the loaded
// artifacts (metrics, segments, drivers, employees). Never invents numbers.
// Used as the live-demo chat engine and as the backend's offline fallback shape.
import * as api from "./api";
import type { I18n } from "./i18n";

export interface Suggestion { label: string; query: string; }
export interface Reply { text: string; suggestions?: Suggestion[]; }

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function has(q: string, ...words: string[]) {
  return words.some((w) => q.includes(w));
}

export function suggestionsFor(t: I18n["t"]): Suggestion[] {
  return [
    { label: t("chat.suggest.attrition"), query: t("chat.suggest.attrition") },
    { label: t("chat.suggest.drivers"), query: t("chat.suggest.drivers") },
    { label: t("chat.suggest.dept"), query: t("chat.suggest.dept") },
    { label: t("chat.suggest.highrisk"), query: t("chat.suggest.highrisk") },
  ];
}

export function answer(raw: string, i18n: I18n): Reply {
  const { t, lang, feature } = i18n;
  const q = raw.toLowerCase().trim();
  const m = api.metrics();
  const seg = api.segments();
  const drivers = api.drivers();
  const o = m.overview;
  const ar = lang === "ar";

  if (!q) return { text: t("chat.greeting"), suggestions: suggestionsFor(t) };

  // Greeting / help (word-boundary match so "hi" doesn't fire inside "which")
  if (/\b(hi|hello|hey|help)\b/.test(q) || has(q, "مرحبا", "مرحباً", "اهلا", "أهلا", "مساعدة", "السلام")) {
    return { text: t("chat.greeting"), suggestions: suggestionsFor(t) };
  }

  // Employee lookup by id
  const idMatch = raw.match(/\b(\d{1,4})\b/);
  if (idMatch && has(q, "employee", "id", "#", "موظف", "رقم", "معرف")) {
    const emp = api.allEmployees().find((e) => e.id === Number(idMatch[1]));
    if (emp) {
      const topUp = emp.top_drivers.filter((d) => d.direction === "increases").slice(0, 2)
        .map((d) => i18n.localizeDriver(d).label);
      return {
        text: ar
          ? `الموظف رقم ${emp.id} (${i18n.value(emp.job_role)}، ${i18n.value(emp.department)}) مخاطرته ${pct(emp.risk_score)} — فئة ${t(`band.${emp.risk_band}`)}. أبرز المحرّكات: ${topUp.join("، ") || "لا يوجد عامل بارز"}.`
          : `Employee #${emp.id} (${emp.job_role}, ${emp.department}) has a risk of ${pct(emp.risk_score)} — ${emp.risk_band} band. Main drivers: ${topUp.join(", ") || "no standout factor"}.`,
      };
    }
    return { text: ar ? `لم أجد موظفاً بالمعرّف ${idMatch[1]}.` : `I couldn't find an employee with ID ${idMatch[1]}.` };
  }

  // Attrition rate
  if (has(q, "attrition rate", "turnover", "leave rate", "معدل", "ترك العمل", "دوران")) {
    return {
      text: ar
        ? `معدّل ترك العمل الفعلي في البيانات هو ${pct(m.dataset.positive_rate)} (${Math.round(m.dataset.positive_rate * o.headcount)} من ${o.headcount} موظف). متوسّط درجة المخاطرة المتوقّعة ${pct(o.avg_risk_score)}.`
        : `The actual attrition rate in the data is ${pct(m.dataset.positive_rate)} (${Math.round(m.dataset.positive_rate * o.headcount)} of ${o.headcount} employees). The average predicted risk score is ${pct(o.avg_risk_score)}.`,
    };
  }

  // High / critical risk count
  if (has(q, "high risk", "high-risk", "critical", "at risk", "how many", "مخاطرة", "مرتفع", "حرج", "كم عدد", "معرض")) {
    return {
      text: ar
        ? `هناك ${o.high_risk_count} موظفاً بمخاطرة عالية أو حرجة (${pct(o.high_risk_count / o.headcount)} من القوى العاملة)، منهم ${o.critical_count} في الفئة الحرجة.`
        : `There are ${o.high_risk_count} employees at high or critical risk (${pct(o.high_risk_count / o.headcount)} of the workforce), of which ${o.critical_count} are critical.`,
    };
  }

  // Top drivers
  if (has(q, "driver", "why", "factor", "cause", "reason", "محرك", "محرّك", "سبب", "عامل", "لماذا")) {
    const top = drivers.slice(0, 5).map((d) => feature(d.feature));
    return {
      text: ar
        ? `أهم محرّكات ترك العمل عبر القوى العاملة (حسب SHAP): ${top.map((x, i) => `${i + 1}) ${x}`).join("، ")}.`
        : `The strongest attrition drivers across the workforce (by SHAP) are: ${top.map((x, i) => `${i + 1}) ${x}`).join(", ")}.`,
    };
  }

  // Department risk
  if (has(q, "department", "dept", "division", "قسم", "إدارة", "اقسام", "أقسام")) {
    const d = seg.by_department;
    const top = d[0];
    const list = d.map((r) => `${ar ? i18n.value(r.name) : r.name} ${pct(r.avg_risk)}`).join(ar ? "، " : ", ");
    return {
      text: ar
        ? `حسب القسم، الأعلى مخاطرة هو ${i18n.value(top.name)} بمتوسّط ${pct(top.avg_risk)}. القائمة الكاملة: ${list}.`
        : `By department, the highest risk is ${top.name} at ${pct(top.avg_risk)} average. Full list: ${list}.`,
    };
  }

  // Role / segment
  if (has(q, "role", "job", "segment", "position", "دور", "وظيفة", "فئة", "منصب")) {
    const r = seg.by_job_role.slice(0, 4);
    const list = r.map((x) => `${ar ? i18n.value(x.name) : x.name} ${pct(x.avg_risk)}`).join(ar ? "، " : ", ");
    return {
      text: ar
        ? `أعلى الأدوار مخاطرةً: ${list}. ركّز جهود الاحتفاظ هنا أولاً.`
        : `The riskiest roles are: ${list}. Focus retention effort here first.`,
    };
  }

  // Model performance
  if (has(q, "model", "accuracy", "auc", "performance", "how good", "نموذج", "دقة", "أداء")) {
    return {
      text: ar
        ? `النموذج المُختار هو ${m.selected_model}، باحتمالات معايَرة. على مجموعة الاختبار المحتجزة: ROC-AUC = ${m.test.roc_auc}، PR-AUC = ${m.test.pr_auc}، درجة براير = ${m.test.brier}.`
        : `The selected model is ${m.selected_model} with calibrated probabilities. On the held-out test split: ROC-AUC = ${m.test.roc_auc}, PR-AUC = ${m.test.pr_auc}, Brier = ${m.test.brier}.`,
    };
  }

  // Reduce risk / advice
  if (has(q, "reduce", "lower", "retain", "keep", "action", "improve", "قلل", "خفض", "احتفاظ", "إجراء", "تحسين", "أخفض")) {
    const topUp = drivers.slice(0, 3).map((d) => feature(d.feature));
    return {
      text: ar
        ? `أكبر الروافع للحدّ من المخاطرة ترتبط بـ ${topUp.join("، ")}. عملياً: راجع عبء العمل الإضافي وعدالة الأجر، وافتح حوارات التقدّم المهني، وأجرِ مقابلات بقاء للموظفين منخفضي الرضا.`
        : `The biggest levers to reduce risk relate to ${topUp.join(", ")}. Practically: review overtime load and pay equity, open career-progression conversations, and run stay interviews for low-satisfaction employees.`,
    };
  }

  // Out of scope — polite decline + redirect
  return {
    text: ar
      ? "أركّز فقط على بيانات ومقاييس القوى العاملة في هذه المنصّة (ترك العمل، المحرّكات، الأقسام، الأدوار، الموظفون). اختر أحد الخيارات أدناه أو أعد صياغة سؤالك ضمن هذا النطاق."
      : "I only cover this platform's workforce data and metrics (attrition, drivers, departments, roles, employees). Pick an option below, or rephrase your question within that scope.",
    suggestions: suggestionsFor(t),
  };
}
