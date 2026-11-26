import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Driver } from "./types";

export type Lang = "en" | "ar";

// ---- UI strings (flat dotted keys) ----
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    "brand.sub": "Workforce Risk Intelligence",
    "nav.overview": "Overview",
    "nav.employees": "Employees",
    "nav.drivers": "Drivers & model",
    "nav.predict": "What-if predictor",
    "nav.batch": "Batch scoring",
    "nav.assistant": "AI assistant",
    "sidebar.foot": "Predictive attrition & retention analytics, built on the IBM HR dataset.",

    "title.overview.h1": "Workforce overview",
    "title.overview.sub": "Attrition risk across the organisation at a glance",
    "title.employees.h1": "Employee register",
    "title.employees.sub": "Find, filter and investigate individual flight risk",
    "title.drivers.h1": "Drivers & model",
    "title.drivers.sub": "What moves attrition risk, and how the model performs",
    "title.predict.h1": "What-if predictor",
    "title.predict.sub": "Estimate attrition risk for any employee profile",
    "title.batch.h1": "Batch scoring",
    "title.batch.sub": "Score a whole CSV of employees in one pass",

    "badge.live": "Live API",
    "badge.demo": "Live demo data",
    "badge.live.tip": "Connected to the live Tenura API",
    "badge.demo.tip": "Running on the bundled dataset and in-browser model",
    "a11y.menu": "Open menu",
    "a11y.theme": "Toggle colour theme",
    "a11y.lang": "Switch language",
    "a11y.close": "Close",

    "kpi.headcount": "Total headcount",
    "kpi.highrisk": "High & critical risk",
    "kpi.attrition": "Actual attrition rate",
    "kpi.avgrisk": "Average risk score",
    "kpi.headcount.sub": "IBM HR Employee Attrition",
    "kpi.highrisk.sub": "{crit} critical · {pct} of staff",
    "kpi.attrition.sub": "Observed in source data",
    "kpi.avgrisk.sub": "Model-estimated, calibrated",

    "card.byDept": "Attrition risk by department",
    "card.byDept.note": "Average calibrated risk score · hover for detail",
    "card.bands": "Risk band distribution",
    "card.bands.note": "Employees grouped by risk tier",
    "card.drivers": "What drives attrition",
    "card.drivers.note": "Global SHAP importance across the workforce",
    "card.drivers.cta": "Explore drivers",
    "card.segments": "Highest-risk segments",
    "card.segments.note": "Where to focus retention effort first",
    "seg.line": "{n} employees · {h} high-risk",
    "seg.avg": "avg risk",
    "chart.employees": "employees",
    "chart.avgRisk": "Avg risk {v}",
    "chart.highOf": "{h} high-risk of {n}",
    "chart.actual": "Actual attrition {v}",
    "chart.shap": "Mean |SHAP| {v}",

    "emp.title": "Employee risk register",
    "emp.note": "{n} employees match · click a row for drivers & retention action",
    "emp.search": "Search role, department or ID…",
    "emp.allDepts": "All departments",
    "emp.otAny": "Overtime: any",
    "emp.otYes": "Overtime: yes",
    "emp.otNo": "Overtime: no",
    "emp.col.id": "ID",
    "emp.col.role": "Role",
    "emp.col.dept": "Department",
    "emp.col.income": "Income",
    "emp.col.tenure": "Tenure",
    "emp.col.ot": "Overtime",
    "emp.col.risk": "Risk",
    "emp.col.band": "Band",
    "emp.sortBy": "Sort by",
    "emp.sortDir": "Toggle sort direction",
    "emp.empty": "No employees match these filters.",
    "pager.prev": "Previous",
    "pager.next": "Next",
    "pager.page": "Page {p} of {t}",

    "drawer.employee": "EMPLOYEE #{id}",
    "drawer.deptLevel": "{dept} · Level {lvl}",
    "drawer.prob": "Estimated probability of attrition",
    "drawer.income": "Monthly income",
    "drawer.tenure": "Tenure",
    "drawer.ot": "Overtime",
    "drawer.jobsat": "Job satisfaction",
    "drawer.wlb": "Work-life balance",
    "drawer.promo": "Since promotion",
    "drawer.why": "Why this risk",
    "drawer.years": "{n} yrs",
    "driver.up": "▲ raises risk",
    "driver.down": "▼ lowers risk",

    "drv.global": "Global attrition drivers",
    "drv.global.note": "Mean |SHAP| contribution across all employees — bigger means more influence on risk",
    "drv.perf": "Model performance",
    "drv.perf.note": "{model} · held-out test split ({n} employees)",
    "drv.m.roc": "Ranking quality",
    "drv.m.pr": "Precision–recall",
    "drv.m.recall": "Leavers caught @0.5",
    "drv.m.brier": "Calibration error",
    "drv.calib": "Probabilities are calibrated ({calib}). Trained on an honest 70/15/15 stratified split of {rows} employees and {feat} features.",
    "drv.select": "Model selection",
    "drv.select.note": "Cross-validated ROC-AUC on the training split",
    "drv.selected": "selected",

    "pred.title": "What-if predictor",
    "pred.note": "Adjust an employee profile and see risk update live — powered by the real trained model",
    "pred.high": "High-risk example",
    "pred.reset": "Reset",
    "pred.result": "Predicted risk",
    "pred.drivers": "Top drivers for this profile",
    "pred.drivers.note": "Why the model scored it this way",
    "f.OverTime": "Works overtime",
    "f.MonthlyIncome": "Monthly income ($)",
    "f.Age": "Age",
    "f.JobLevel": "Job level",
    "f.JobSatisfaction": "Job satisfaction (1–4)",
    "f.EnvironmentSatisfaction": "Environment satisfaction (1–4)",
    "f.WorkLifeBalance": "Work-life balance (1–4)",
    "f.YearsAtCompany": "Years at company",
    "f.YearsSinceLastPromotion": "Years since promotion",
    "f.YearsWithCurrManager": "Years with manager",
    "f.StockOptionLevel": "Stock option level",
    "f.DistanceFromHome": "Commute distance (km)",
    "f.BusinessTravel": "Business travel",
    "f.Department": "Department",
    "f.JobRole": "Job role",
    "f.MaritalStatus": "Marital status",

    "batch.title": "Batch scoring",
    "batch.note": "Upload a CSV of employees (IBM HR schema) to score every row at once",
    "batch.scoring": "Scoring…",
    "batch.drop": "Drop a CSV here or click to browse",
    "batch.privacy": "Scored in your browser — no data leaves this page",
    "batch.sample": "Load demo sample",
    "batch.download": "Download results",
    "batch.results": "Scored results",
    "batch.results.note": "{n} employees scored · {h} high or critical risk",
    "batch.col.id": "Employee ID",
    "batch.col.risk": "Risk score",
    "batch.showing": "Showing the 200 highest-risk rows. Download for the full {n}.",
    "batch.err": "Could not score this file.",

    "band.Low": "Low",
    "band.Moderate": "Moderate",
    "band.High": "High",
    "band.Critical": "Critical",

    "chat.title": "Atlas · workforce assistant",
    "chat.sub": "Grounded in your live workforce data",
    "chat.open": "Open AI assistant",
    "chat.placeholder": "Ask about attrition, drivers, segments…",
    "chat.send": "Send",
    "chat.greeting": "Hi! I'm Atlas, your workforce assistant. I can answer questions grounded in this dashboard's data — attrition, risk drivers, departments, roles and individual employees. What would you like to know?",
    "chat.thinking": "Thinking…",
    "chat.clear": "Clear chat",
    "chat.poweredGemini": "Powered by Google Gemini",
    "chat.poweredLocal": "On-device retrieval mode",
    "chat.suggest.attrition": "Overall attrition rate",
    "chat.suggest.drivers": "Top attrition drivers",
    "chat.suggest.dept": "Riskiest department",
    "chat.suggest.highrisk": "How many high-risk?",
  },
  ar: {
    "brand.sub": "ذكاء مخاطر القوى العاملة",
    "nav.overview": "نظرة عامة",
    "nav.employees": "الموظفون",
    "nav.drivers": "المحرّكات والنموذج",
    "nav.predict": "مُتنبّئ الاحتمالات",
    "nav.batch": "التقييم الجماعي",
    "nav.assistant": "المساعد الذكي",
    "sidebar.foot": "تحليلات تنبؤية لترك العمل والاحتفاظ بالموظفين، مبنية على بيانات IBM للموارد البشرية.",

    "title.overview.h1": "نظرة عامة على القوى العاملة",
    "title.overview.sub": "مخاطر ترك العمل عبر المؤسسة في لمحة",
    "title.employees.h1": "سجل الموظفين",
    "title.employees.sub": "ابحث وصفِّ وحلّل مخاطر ترك كل موظف",
    "title.drivers.h1": "المحرّكات والنموذج",
    "title.drivers.sub": "ما الذي يحرّك مخاطر ترك العمل، وكيف يؤدّي النموذج",
    "title.predict.h1": "مُتنبّئ الاحتمالات",
    "title.predict.sub": "قدّر مخاطر ترك العمل لأي ملف موظف",
    "title.batch.h1": "التقييم الجماعي",
    "title.batch.sub": "قيّم ملف CSV كاملاً من الموظفين دفعة واحدة",

    "badge.live": "واجهة حيّة",
    "badge.demo": "بيانات عرض حيّة",
    "badge.live.tip": "متصل بواجهة Tenura الحيّة",
    "badge.demo.tip": "يعمل على البيانات المضمّنة والنموذج داخل المتصفح",
    "a11y.menu": "فتح القائمة",
    "a11y.theme": "تبديل سمة الألوان",
    "a11y.lang": "تغيير اللغة",
    "a11y.close": "إغلاق",

    "kpi.headcount": "إجمالي عدد الموظفين",
    "kpi.highrisk": "مخاطر عالية وحرجة",
    "kpi.attrition": "معدّل ترك العمل الفعلي",
    "kpi.avgrisk": "متوسّط درجة المخاطرة",
    "kpi.headcount.sub": "بيانات IBM لترك الموظفين",
    "kpi.highrisk.sub": "{crit} حرجة · {pct} من الموظفين",
    "kpi.attrition.sub": "ملاحَظ في البيانات المصدرية",
    "kpi.avgrisk.sub": "مُقدَّر بالنموذج ومعاير",

    "card.byDept": "مخاطر ترك العمل حسب القسم",
    "card.byDept.note": "متوسّط درجة المخاطرة المعايَرة · مرّر للتفاصيل",
    "card.bands": "توزيع فئات المخاطرة",
    "card.bands.note": "الموظفون مُصنّفون حسب مستوى المخاطرة",
    "card.drivers": "ما الذي يدفع لترك العمل",
    "card.drivers.note": "أهمية SHAP العامة عبر القوى العاملة",
    "card.drivers.cta": "استكشاف المحرّكات",
    "card.segments": "الفئات الأعلى مخاطرة",
    "card.segments.note": "أين تُركّز جهود الاحتفاظ أولاً",
    "seg.line": "{n} موظفاً · {h} مرتفعو المخاطرة",
    "seg.avg": "متوسّط المخاطرة",
    "chart.employees": "موظف",
    "chart.avgRisk": "متوسّط المخاطرة {v}",
    "chart.highOf": "{h} مرتفعو المخاطرة من {n}",
    "chart.actual": "ترك فعلي {v}",
    "chart.shap": "متوسّط ‏|SHAP|‏ {v}",

    "emp.title": "سجل مخاطر الموظفين",
    "emp.note": "{n} موظفاً مطابقاً · انقر صفاً لعرض المحرّكات وإجراء الاحتفاظ",
    "emp.search": "ابحث بالدور أو القسم أو المعرّف…",
    "emp.allDepts": "كل الأقسام",
    "emp.otAny": "العمل الإضافي: الكل",
    "emp.otYes": "العمل الإضافي: نعم",
    "emp.otNo": "العمل الإضافي: لا",
    "emp.col.id": "المعرّف",
    "emp.col.role": "الدور",
    "emp.col.dept": "القسم",
    "emp.col.income": "الدخل",
    "emp.col.tenure": "المدّة",
    "emp.col.ot": "إضافي",
    "emp.col.risk": "المخاطرة",
    "emp.col.band": "الفئة",
    "emp.sortBy": "ترتيب حسب",
    "emp.sortDir": "تبديل اتجاه الترتيب",
    "emp.empty": "لا يوجد موظفون مطابقون لهذه المرشّحات.",
    "pager.prev": "السابق",
    "pager.next": "التالي",
    "pager.page": "صفحة {p} من {t}",

    "drawer.employee": "الموظف رقم {id}",
    "drawer.deptLevel": "{dept} · المستوى {lvl}",
    "drawer.prob": "الاحتمال المُقدَّر لترك العمل",
    "drawer.income": "الدخل الشهري",
    "drawer.tenure": "المدّة",
    "drawer.ot": "العمل الإضافي",
    "drawer.jobsat": "الرضا الوظيفي",
    "drawer.wlb": "التوازن بين العمل والحياة",
    "drawer.promo": "منذ آخر ترقية",
    "drawer.why": "سبب هذه المخاطرة",
    "drawer.years": "{n} سنة",
    "driver.up": "▲ يرفع المخاطرة",
    "driver.down": "▼ يخفّض المخاطرة",

    "drv.global": "محرّكات ترك العمل العامة",
    "drv.global.note": "متوسّط مساهمة ‏|SHAP|‏ عبر كل الموظفين — كلما كبر زاد تأثيره على المخاطرة",
    "drv.perf": "أداء النموذج",
    "drv.perf.note": "{model} · مجموعة اختبار محتجزة ({n} موظف)",
    "drv.m.roc": "جودة الترتيب",
    "drv.m.pr": "الدقة والاستدعاء",
    "drv.m.recall": "اكتشاف التاركين عند 0.5",
    "drv.m.brier": "خطأ المعايرة",
    "drv.calib": "الاحتمالات معايَرة ({calib}). دُرّب على تقسيم طبقي نزيه 70/15/15 على {rows} موظفاً و{feat} سمة.",
    "drv.select": "اختيار النموذج",
    "drv.select.note": "ROC-AUC بالتحقق المتقاطع على مجموعة التدريب",
    "drv.selected": "مُختار",

    "pred.title": "مُتنبّئ الاحتمالات",
    "pred.note": "عدّل ملف الموظف وشاهد المخاطرة تتحدّث مباشرة — مدعوم بالنموذج المُدرَّب الحقيقي",
    "pred.high": "مثال عالي المخاطرة",
    "pred.reset": "إعادة تعيين",
    "pred.result": "المخاطرة المتوقّعة",
    "pred.drivers": "أهم المحرّكات لهذا الملف",
    "pred.drivers.note": "لماذا منح النموذج هذه الدرجة",
    "f.OverTime": "يعمل ساعات إضافية",
    "f.MonthlyIncome": "الدخل الشهري ($)",
    "f.Age": "العمر",
    "f.JobLevel": "المستوى الوظيفي",
    "f.JobSatisfaction": "الرضا الوظيفي (1–4)",
    "f.EnvironmentSatisfaction": "الرضا عن بيئة العمل (1–4)",
    "f.WorkLifeBalance": "التوازن بين العمل والحياة (1–4)",
    "f.YearsAtCompany": "سنوات في الشركة",
    "f.YearsSinceLastPromotion": "سنوات منذ آخر ترقية",
    "f.YearsWithCurrManager": "سنوات مع المدير الحالي",
    "f.StockOptionLevel": "مستوى خيارات الأسهم",
    "f.DistanceFromHome": "مسافة التنقّل (كم)",
    "f.BusinessTravel": "السفر للعمل",
    "f.Department": "القسم",
    "f.JobRole": "الدور الوظيفي",
    "f.MaritalStatus": "الحالة الاجتماعية",

    "batch.title": "التقييم الجماعي",
    "batch.note": "ارفع ملف CSV للموظفين (مخطط IBM HR) لتقييم كل صف دفعة واحدة",
    "batch.scoring": "جارٍ التقييم…",
    "batch.drop": "أفلت ملف CSV هنا أو انقر للتصفّح",
    "batch.privacy": "يُقيَّم داخل متصفّحك — لا تغادر أي بيانات هذه الصفحة",
    "batch.sample": "تحميل عيّنة تجريبية",
    "batch.download": "تنزيل النتائج",
    "batch.results": "النتائج المُقيَّمة",
    "batch.results.note": "{n} موظفاً مُقيَّماً · {h} بمخاطرة عالية أو حرجة",
    "batch.col.id": "معرّف الموظف",
    "batch.col.risk": "درجة المخاطرة",
    "batch.showing": "عرض أعلى 200 صف مخاطرة. نزّل الملف لكامل {n}.",
    "batch.err": "تعذّر تقييم هذا الملف.",

    "band.Low": "منخفضة",
    "band.Moderate": "متوسّطة",
    "band.High": "عالية",
    "band.Critical": "حرجة",

    "chat.title": "أطلس · مساعد القوى العاملة",
    "chat.sub": "مستند إلى بيانات قواك العاملة الحيّة",
    "chat.open": "فتح المساعد الذكي",
    "chat.placeholder": "اسأل عن ترك العمل أو المحرّكات أو الفئات…",
    "chat.send": "إرسال",
    "chat.greeting": "مرحباً! أنا أطلس، مساعد القوى العاملة. أجيب عن أسئلة مستندة إلى بيانات هذه اللوحة — ترك العمل، محرّكات المخاطرة، الأقسام، الأدوار والموظفون الأفراد. بماذا أساعدك؟",
    "chat.thinking": "أفكّر…",
    "chat.clear": "مسح المحادثة",
    "chat.poweredGemini": "مدعوم بـ Google Gemini",
    "chat.poweredLocal": "وضع الاسترجاع داخل الجهاز",
    "chat.suggest.attrition": "معدّل ترك العمل الإجمالي",
    "chat.suggest.drivers": "أهم محرّكات ترك العمل",
    "chat.suggest.dept": "القسم الأعلى مخاطرة",
    "chat.suggest.highrisk": "كم عدد مرتفعي المخاطرة؟",
  },
};

// ---- Localized maps for data-driven text (keyed by canonical English token) ----
export const FEATURE_I18N: Record<string, { en: string; ar: string }> = {
  Age: { en: "Age", ar: "العمر" },
  DailyRate: { en: "Daily rate", ar: "الأجر اليومي" },
  DistanceFromHome: { en: "Commute distance", ar: "مسافة التنقّل" },
  Education: { en: "Education level", ar: "مستوى التعليم" },
  EnvironmentSatisfaction: { en: "Environment satisfaction", ar: "الرضا عن بيئة العمل" },
  HourlyRate: { en: "Hourly rate", ar: "الأجر بالساعة" },
  JobInvolvement: { en: "Job involvement", ar: "الانخراط في العمل" },
  JobLevel: { en: "Job level", ar: "المستوى الوظيفي" },
  JobSatisfaction: { en: "Job satisfaction", ar: "الرضا الوظيفي" },
  MonthlyIncome: { en: "Monthly income", ar: "الدخل الشهري" },
  MonthlyRate: { en: "Monthly rate", ar: "المعدّل الشهري" },
  NumCompaniesWorked: { en: "Number of prior employers", ar: "عدد جهات العمل السابقة" },
  PercentSalaryHike: { en: "Last salary hike %", ar: "نسبة آخر زيادة راتب" },
  PerformanceRating: { en: "Performance rating", ar: "تقييم الأداء" },
  RelationshipSatisfaction: { en: "Relationship satisfaction", ar: "الرضا عن العلاقات" },
  StockOptionLevel: { en: "Stock option level", ar: "مستوى خيارات الأسهم" },
  TotalWorkingYears: { en: "Total working years", ar: "إجمالي سنوات العمل" },
  TrainingTimesLastYear: { en: "Trainings last year", ar: "التدريبات العام الماضي" },
  WorkLifeBalance: { en: "Work-life balance", ar: "التوازن بين العمل والحياة" },
  YearsAtCompany: { en: "Years at company", ar: "سنوات في الشركة" },
  YearsInCurrentRole: { en: "Years in current role", ar: "سنوات في الدور الحالي" },
  YearsSinceLastPromotion: { en: "Years since last promotion", ar: "سنوات منذ آخر ترقية" },
  YearsWithCurrManager: { en: "Years with current manager", ar: "سنوات مع المدير الحالي" },
  TenureRatio: { en: "Share of career spent here", ar: "نسبة المسيرة المهنية هنا" },
  IncomePerLevel: { en: "Pay for job level", ar: "الأجر مقابل المستوى" },
  PromotionStagnation: { en: "Promotion stagnation", ar: "ركود الترقيات" },
  ManagerStability: { en: "Manager stability", ar: "استقرار المدير" },
  AgeAtJoining: { en: "Age when joined", ar: "العمر عند الالتحاق" },
  SatisfactionIndex: { en: "Overall satisfaction", ar: "الرضا العام" },
  IncomePerYearWorked: { en: "Pay per year of experience", ar: "الأجر لكل سنة خبرة" },
  RoleTenureShare: { en: "Time settled in current role", ar: "الاستقرار في الدور الحالي" },
  BusinessTravel: { en: "Business travel", ar: "السفر للعمل" },
  Department: { en: "Department", ar: "القسم" },
  EducationField: { en: "Field of study", ar: "مجال الدراسة" },
  Gender: { en: "Gender", ar: "الجنس" },
  JobRole: { en: "Job role", ar: "الدور الوظيفي" },
  MaritalStatus: { en: "Marital status", ar: "الحالة الاجتماعية" },
  OverTime: { en: "Works overtime", ar: "يعمل ساعات إضافية" },
};

const VALUE_I18N: Record<string, string> = {
  Yes: "نعم", No: "لا",
  Sales: "المبيعات", "Research & Development": "البحث والتطوير", "Human Resources": "الموارد البشرية",
  Single: "أعزب", Married: "متزوّج", Divorced: "مطلّق",
  Travel_Rarely: "سفر نادر", Travel_Frequently: "سفر متكرّر", "Non-Travel": "بدون سفر",
  "Sales Executive": "تنفيذي مبيعات", "Research Scientist": "باحث علمي",
  "Laboratory Technician": "فنّي مختبر", "Manufacturing Director": "مدير تصنيع",
  "Healthcare Representative": "مندوب رعاية صحية", Manager: "مدير",
  "Sales Representative": "مندوب مبيعات", "Research Director": "مدير بحوث",
  "Life Sciences": "علوم الحياة", Medical: "طبّي", Marketing: "تسويق",
  "Technical Degree": "شهادة تقنية", Other: "أخرى",
};

const ACTION_I18N: Record<string, { en: string; ar: string }> = {
  OverTime: { en: "Rebalance workload or formalise overtime pay; sustained overtime is a top attrition driver.", ar: "أعد توازن عبء العمل أو نظّم أجر العمل الإضافي؛ فالعمل الإضافي المستمر من أبرز محرّكات ترك العمل." },
  MonthlyIncome: { en: "Benchmark compensation against market; this employee may be underpaid for their level.", ar: "قارن الأجر بالسوق؛ قد يكون هذا الموظف أقل أجراً من مستواه." },
  IncomePerLevel: { en: "Review pay equity for the job level — compensation looks low for the responsibility.", ar: "راجع عدالة الأجر للمستوى الوظيفي — يبدو التعويض منخفضاً مقابل المسؤولية." },
  IncomePerYearWorked: { en: "Check that pay has kept pace with accumulated experience.", ar: "تأكّد أن الأجر واكب الخبرة المتراكمة." },
  StockOptionLevel: { en: "Consider adding or increasing equity to strengthen long-term commitment.", ar: "فكّر في منح أو زيادة الأسهم لتعزيز الالتزام طويل المدى." },
  YearsSinceLastPromotion: { en: "Open a career-progression conversation; promotion has stalled.", ar: "ابدأ حواراً حول التقدّم المهني؛ فقد تعطّلت الترقية." },
  PromotionStagnation: { en: "Build a concrete promotion or growth plan — advancement has stagnated.", ar: "ضع خطة ترقية أو نموّ ملموسة — فقد ركد التقدّم." },
  JobSatisfaction: { en: "Run a stay interview to surface and fix satisfaction blockers.", ar: "أجرِ مقابلة بقاء لكشف معوّقات الرضا ومعالجتها." },
  EnvironmentSatisfaction: { en: "Address workplace-environment concerns raised in engagement surveys.", ar: "عالج مخاوف بيئة العمل التي ظهرت في استبيانات المشاركة." },
  SatisfactionIndex: { en: "Overall satisfaction is low — prioritise a manager-led stay interview.", ar: "الرضا العام منخفض — أعطِ الأولوية لمقابلة بقاء يقودها المدير." },
  WorkLifeBalance: { en: "Offer flexibility or workload relief to improve work-life balance.", ar: "وفّر مرونة أو تخفيفاً لعبء العمل لتحسين التوازن." },
  JobInvolvement: { en: "Increase ownership and meaningful work to lift engagement.", ar: "زد الملكية والعمل ذا المعنى لرفع المشاركة." },
  DistanceFromHome: { en: "Explore hybrid or remote options to ease a long commute.", ar: "استكشف خيارات العمل الهجين أو عن بُعد لتخفيف التنقّل الطويل." },
  Age: { en: "Tailor retention to career stage with targeted development or mentoring.", ar: "خصّص الاحتفاظ حسب المرحلة المهنية بتطوير أو إرشاد موجّه." },
  TotalWorkingYears: { en: "Match growth opportunities to the employee's experience level.", ar: "وائم فرص النمو مع مستوى خبرة الموظف." },
  YearsAtCompany: { en: "Recognise tenure and re-energise with a fresh challenge or lateral move.", ar: "قدّر مدّة الخدمة وجدّد الحماس بتحدٍّ جديد أو نقل أفقي." },
  YearsWithCurrManager: { en: "Assess the manager relationship; low manager tenure can raise flight risk.", ar: "قيّم العلاقة مع المدير؛ فقصر مدّة المدير قد يرفع مخاطر المغادرة." },
  ManagerStability: { en: "Stabilise reporting lines — frequent manager changes erode retention.", ar: "ثبّت خطوط الإبلاغ — فكثرة تغيير المديرين تُضعف الاحتفاظ." },
  BusinessTravel: { en: "Reduce or better support travel load where it is driving fatigue.", ar: "قلّل عبء السفر أو ادعمه حيث يسبّب الإرهاق." },
  NumCompaniesWorked: { en: "Reinforce belonging and growth path for a historically mobile hire.", ar: "عزّز الانتماء ومسار النمو لموظف كثير التنقّل تاريخياً." },
  JobRole: { en: "Review role-specific retention risks and career ladders.", ar: "راجع مخاطر الاحتفاظ الخاصة بالدور ومسارات الترقّي." },
  MaritalStatus: { en: "Ensure benefits and flexibility fit the employee's life stage.", ar: "تأكّد أن المزايا والمرونة تناسب مرحلة حياة الموظف." },
};

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export interface I18n {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  localizeDriver: (d: Driver) => { label: string; action: string | null; direction: string };
  feature: (token: string) => string;
  value: (v: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const s = localStorage.getItem("tenura-lang");
      if (s === "en" || s === "ar") return s;
    } catch { /* ignore */ }
    return (navigator.language || "en").startsWith("ar") ? "ar" : "en";
  });

  const dir: "ltr" | "rtl" = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    try { localStorage.setItem("tenura-lang", lang); } catch { /* ignore */ }
  }, [lang, dir]);

  const value = useMemo<I18n>(() => {
    const feature = (token: string) => FEATURE_I18N[token]?.[lang] ?? token;
    const value = (v: string) => (lang === "ar" ? VALUE_I18N[v] ?? v : v);
    return {
      lang, dir, setLang: setLangState,
      t: (key, vars) => interpolate(DICT[lang][key] ?? DICT.en[key] ?? key, vars),
      feature, value,
      localizeDriver: (d: Driver) => {
        const isCat = d.label.includes(": ");
        let label: string;
        if (isCat) {
          const raw = d.label.split(": ").slice(1).join(": ");
          label = `${feature(d.feature)}: ${value(raw)}`;
        } else {
          label = feature(d.feature);
        }
        const action = d.direction === "increases" ? ACTION_I18N[d.feature]?.[lang] ?? d.action : null;
        return { label, action, direction: d.direction };
      },
    };
  }, [lang, dir]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n outside provider");
  return c;
}
