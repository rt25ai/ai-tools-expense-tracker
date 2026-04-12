import { cache } from "react";
import fs from "node:fs";
import path from "node:path";
import { convertUsdToIls, formatMonthLabel } from "@/lib/formatters";
import { DEFAULT_MONTHLY_BUDGET } from "@/lib/monthly-budget";

export type TransactionSource = "manual" | "auto" | "email-imported" | "ai-extracted";
export type ChargeType = "recurring" | "one-time";
export type VendorStatus = "healthy" | "watch" | "manual";
export type BillingStatus = "active" | "stopped" | "one-time";

type RawTransaction = {
  date: string;
  tool: string;
  description: string;
  currency?: "USD" | "ILS";
  original_amount?: number;
  amount_usd?: number;
  amount_ils?: number;
  entry_source?: TransactionSource | null;
};

type RawDashboardData = {
  generated: string;
  usd_rate: number;
  exchange_rate_updated_at?: string;
  exchange_rate_source?: string;
  grand_total: number;
  grand_total_ils: number;
  current_month: string;
  current_month_total: number;
  current_month_total_ils: number;
  scanner_status?: {
    last_run: string;
    next_run: string;
    result: "ok" | "found" | "error";
    new_count: number;
    new_tools: string[];
    error: string | null;
  } | null;
  transactions: RawTransaction[];
  monthly: Record<string, number>;
  monthly_ils?: Record<string, number>;
  by_tool: Record<string, number>;
  by_tool_ils?: Record<string, number>;
};

type VendorMetadata = {
  category: string;
  source: TransactionSource;
  confidence: number;
  owner: string;
  notes: string;
};

export type VendorRule = {
  subscription?: boolean;
  billing_status?: BillingStatus;
  billing_day?: number;
  expected_amount?: number;
  billing_currency?: "USD" | "ILS";
  auto_add_to_sheet?: boolean;
  start_month?: string;
  sheet_description?: string;
};

type VendorConfig = VendorMetadata & {
  subscription?: boolean;
  recurring?: boolean;
  billingStatus?: BillingStatus;
  billingDay?: number;
  expectedAmount?: number;
  billingCurrency?: "USD" | "ILS";
  autoAddToSheet?: boolean;
};

export type EnrichedTransaction = RawTransaction & {
  id: string;
  monthKey: string;
  source: TransactionSource;
  type: ChargeType;
  category: string;
  confidence: number;
  amountUsd: number;
  amountIls: number;
};

export type VendorSummary = {
  name: string;
  totalSpend: number;
  currentMonthSpend: number;
  lastChargeDate: string | null;
  nextExpectedDate: string | null;
  expectedAmount: number | null;
  recurring: boolean;
  billingStatus: BillingStatus;
  source: TransactionSource;
  category: string;
  confidence: number;
  status: VendorStatus;
  chargeCount: number;
  notes: string;
  owner: string;
};

export type AutomationItem = {
  name: string;
  cadence: string;
  status: "active" | "watch" | "semi-auto";
  description: string;
  lastRun: string;
  nextRun: string;
};

export type ReviewItem = {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  reason: string;
  severity: "high" | "medium" | "low";
};

export type AuditEvent = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
};

export type SettingsModel = {
  finance: {
    usdRate: number;
    exchangeRateUpdatedAt?: string | null;
    exchangeRateSource?: string;
    defaultBillingDay: number;
    monthlyBudget: number;
  };
  detection: {
    scanWindowDays: number;
    parserMode: string;
    ignoredSenders: string[];
  };
  vendors: {
    knownVendors: string[];
    manualOnlyVendors: string[];
  };
  recurringRules: {
    openAiEnabled: boolean;
    autopublishEnabled: boolean;
    rebuildDashboardOnChange: boolean;
  };
};

export type DashboardModel = {
  raw: RawDashboardData;
  transactions: EnrichedTransaction[];
  monthlySeries: { key: string; label: string; total: number; budget: number; intensity: number }[];
  recurringSeries: { label: string; value: number; share: number }[];
  vendors: VendorSummary[];
  automations: AutomationItem[];
  auditLog: AuditEvent[];
  needsReview: ReviewItem[];
  settings: SettingsModel;
  stats: {
    totalYtd: number;
    currentMonth: number;
    recurringBaseline: number;
    unexpectedCharges: number;
    recurringShare: number;
  };
};

export type ReportMonth = {
  key: string;
  label: string;
  year: string;
  total: number;
  budget: number;
  variance: number;
  varianceRatio: number;
  transactionCount: number;
  recurringCount: number;
  oneTimeCount: number;
  recurringTotal: number;
  oneTimeTotal: number;
  needsReviewCount: number;
  transactions: EnrichedTransaction[];
  topVendors: { name: string; total: number; chargeCount: number }[];
  previousMonthKey: string | null;
  nextMonthKey: string | null;
};

export type ReportYear = {
  year: string;
  total: number;
  budget: number;
  variance: number;
  monthCount: number;
  recurringTotal: number;
  oneTimeTotal: number;
  months: ReportMonth[];
  topVendors: { name: string; total: number; chargeCount: number }[];
};

function readVendorRules(): Record<string, VendorRule> {
  const filePath = path.join(process.cwd(), "..", "vendor_rules.json");
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, VendorRule>;
}

export function getVendorRules(): Record<string, VendorRule> {
  return readVendorRules();
}

const vendorRules = readVendorRules();

const vendorCatalog: Record<string, VendorConfig> = {
  OpenAI: {
    category: "מודל AI",
    source: "auto",
    recurring: true,
    billingDay: 16,
    expectedAmount: 20,
    confidence: 0.99,
    owner: "תפעול פיננסי",
    notes: "כלל קבוע של ChatGPT Plus מתווסף אוטומטית בכל 16 לחודש עד סוף השנה.",
  },
  Anthropic: {
    category: "מודל AI",
    source: "email-imported",
    recurring: true,
    billingDay: 15,
    expectedAmount: 20,
    confidence: 0.92,
    owner: "תפעול פיננסי",
    notes: "המנוי הראשי של Claude, לעיתים עם טעינות קרדיטים נוספות.",
  },
  "Google Workspace": {
    category: "כלי עבודה",
    source: "email-imported",
    recurring: true,
    billingDay: 2,
    expectedAmount: 75.9,
    billingCurrency: "ILS",
    confidence: 0.97,
    owner: "תפעול",
    notes: "מחויב ישירות בשקלים, ולכן נשמר ומוצג לפי הסכום המקורי שבקבלה.",
  },
  CapCut: {
    category: "וידאו",
    source: "email-imported",
    recurring: true,
    billingDay: 10,
    expectedAmount: 49.9,
    billingCurrency: "ILS",
    confidence: 0.89,
    owner: "קריאייטיב",
    notes: "מחויב בשקלים ומוצג לפי הסכום המדויק מהחשבונית של CapCut.",
  },
  "Eleven Labs": {
    category: "קול",
    source: "email-imported",
    recurring: true,
    billingDay: 30,
    expectedAmount: 11,
    confidence: 0.9,
    owner: "קריאייטיב",
    notes: "מנוי חודשי עם שינויים מזדמנים בחבילה.",
  },
  Make: {
    category: "אוטומציה",
    source: "email-imported",
    recurring: true,
    billingDay: 10,
    expectedAmount: 10.59,
    confidence: 0.94,
    owner: "תפעול",
    notes: "הוצאת האוטומציה המרכזית של תהליכי העבודה.",
  },
  Manychat: {
    category: "אוטומציה",
    source: "email-imported",
    recurring: true,
    billingDay: 3,
    expectedAmount: 15,
    confidence: 0.91,
    owner: "צמיחה",
    notes: "חבילת אוטומציה לפאנל צ'אט ולידים.",
  },
  Timeless: {
    category: "וידאו",
    source: "manual",
    recurring: true,
    billingDay: 1,
    expectedAmount: 14.5,
    confidence: 0.8,
    owner: "קריאייטיב",
    notes: "חיוב חוזר ידני במסלול מוזל.",
  },
  Lovable: {
    category: "בניית מוצרים",
    source: "manual",
    recurring: true,
    billingDay: 25,
    expectedAmount: 25,
    confidence: 0.73,
    owner: "פיתוח",
    notes: "מנוי משתנה וטעינות נוספות. כדאי לעקוב אחרי שינויים בחבילה.",
  },
  "Runway ML": {
    category: "וידאו",
    source: "email-imported",
    recurring: false,
    confidence: 0.86,
    owner: "קריאייטיב",
    notes: "שימושים וחבילות קרדיטים שמיובאים מהמייל.",
  },
  Replicate: {
    category: "חישוב",
    source: "email-imported",
    recurring: false,
    confidence: 0.9,
    owner: "פיתוח",
    notes: "חיובי חישוב לפי שימוש.",
  },
  Recraft: {
    category: "עיצוב",
    source: "email-imported",
    recurring: false,
    confidence: 0.9,
    owner: "קריאייטיב",
    notes: "קרדיטים ושינויים בחבילה שמיובאים מהמייל.",
  },
  "Ideogram AI": {
    category: "עיצוב",
    source: "email-imported",
    recurring: false,
    confidence: 0.96,
    owner: "קריאייטיב",
    notes: "חיובים שנתיים ושדרוגים שיובאו מתיבת המייל.",
  },
  Genspark: {
    category: "מודל AI",
    source: "email-imported",
    recurring: false,
    confidence: 0.9,
    owner: 'מו"פ',
    notes: "תוכנית שנתית וקרדיטים מזדמנים.",
  },
  "Meta (Ads)": {
    category: "פרסום ממומן",
    source: "manual",
    recurring: false,
    confidence: 0.68,
    owner: "צמיחה",
    notes: "הוצאות פרסום שמוזנות ידנית. מועמד טוב לסנכרון API ישיר בהמשך.",
  },
  IONOS: {
    category: "דומיינים",
    source: "manual",
    recurring: false,
    confidence: 0.75,
    owner: "תפעול",
    notes: "רכישת דומיין שנוספה ידנית.",
  },
  "Manus AI": {
    category: "מודל AI",
    source: "manual",
    recurring: true,
    billingDay: 9,
    expectedAmount: 19,
    confidence: 0.67,
    owner: 'מו"פ',
    notes: "חיוב ידני ישן שעדיין לא חובר לזיהוי מהמייל.",
  },
  Higgsfield: {
    category: "וידאו",
    source: "email-imported",
    recurring: false,
    confidence: 0.84,
    owner: "קריאייטיב",
    notes: "חבילת קרדיטים חד־פעמית שיובאה מ־PDF של חשבונית.",
  },
  Astria: {
    category: "יצירת תמונות",
    source: "manual",
    recurring: false,
    confidence: 0.72,
    owner: "קריאייטיב",
    notes: "רכישת קרדיטים חד־פעמית.",
  },
  Hedra: {
    category: "וידאו",
    source: "manual",
    recurring: false,
    confidence: 0.7,
    owner: "קריאייטיב",
    notes: "הזנה ידנית של חבילת קרדיטים.",
  },
};

function getVendorConfig(tool: string): VendorConfig {
  const baseConfig = vendorCatalog[tool] ?? vendorFallback(tool);
  const rule = vendorRules[tool];
  const subscription = rule?.subscription ?? baseConfig.subscription ?? baseConfig.recurring ?? false;
  const billingStatus =
    rule?.billing_status ??
    baseConfig.billingStatus ??
    (subscription ? "active" : "one-time");

  return {
    ...baseConfig,
    subscription,
    billingStatus,
    billingDay: rule?.billing_day ?? baseConfig.billingDay,
    expectedAmount: rule?.expected_amount ?? baseConfig.expectedAmount,
    billingCurrency: rule?.billing_currency ?? baseConfig.billingCurrency,
    autoAddToSheet: rule?.auto_add_to_sheet ?? baseConfig.autoAddToSheet,
  };
}

function cleanText(value: string) {
  return value.replaceAll("ג€“", "–").replaceAll("ג‚×", "₪").replace(/\s+/g, " ").trim();
}

function sanitizeText(value: string) {
  return value
    .replaceAll("â€“", "-")
    .replaceAll("â€”", "-")
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("â€™", "'")
    .replaceAll("₪", "NIS ")
    .replace(/\s+/g, " ")
    .trim();
}

function readRawData(): RawDashboardData {
  const filePath = path.join(process.cwd(), "public", "data.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as RawDashboardData;
}

function monthLabel(key: string) {
  return formatMonthLabel(key, "short");
}

function nextExpectedDate(currentMonth: string, billingDay: number) {
  const [year, month] = currentMonth.split("-").map(Number);
  const current = new Date(year, month - 1, billingDay);
  const today = new Date();

  if (current >= today) return current.toISOString().slice(0, 10);

  const next = new Date(year, month, billingDay);
  return next.toISOString().slice(0, 10);
}

function sourceLabel(source: TransactionSource) {
  switch (source) {
    case "auto":
      return "אוטומטי";
    case "manual":
      return "ידני";
    case "ai-extracted":
      return "חולץ ב־AI";
    default:
      return "יובא ממייל";
  }
}

function billingStatusLabel(status: BillingStatus) {
  switch (status) {
    case "active":
      return "מנוי פעיל";
    case "stopped":
      return "מנוי שהופסק";
    default:
      return "חד-פעמי / משתנה";
  }
}

function vendorFallback(tool: string): VendorConfig {
  return {
    category: "ללא סיווג",
    source: "manual",
    subscription: false,
    billingStatus: "one-time",
    confidence: 0.55,
    owner: "תפעול פיננסי",
    notes: `עדיין לא הוגדר כלל מפורש עבור הספק ${tool}.`,
  };
}

export const getDashboardModel = cache((): DashboardModel => {
  const raw = readRawData();
  const currentYear = raw.current_month.slice(0, 4);

  const transactions = raw.transactions.map((transaction, index) => {
    const config = getVendorConfig(transaction.tool);
    const amountUsd = transaction.amount_usd ?? 0;
    const amountIls = transaction.amount_ils ?? convertUsdToIls(amountUsd, raw.usd_rate);
    return {
      ...transaction,
      id: `${transaction.date}-${transaction.tool}-${index}`,
      description: sanitizeText(cleanText(transaction.description)),
      monthKey: transaction.date.slice(0, 7),
      source: transaction.entry_source ?? config.source,
      type: config.subscription ? "recurring" : "one-time",
      category: config.category,
      confidence: config.confidence,
      amountUsd,
      amountIls,
    } satisfies EnrichedTransaction;
  });

  const recurringTotalUsd = transactions
    .filter((transaction) => transaction.type === "recurring")
    .reduce((sum, transaction) => sum + transaction.amountUsd, 0);
  const recurringTotalIls = transactions
    .filter((transaction) => transaction.type === "recurring")
    .reduce((sum, transaction) => sum + transaction.amountIls, 0);
  const oneTimeTotalIls = Math.max(raw.grand_total_ils - recurringTotalIls, 0);
  const recurringBaselineIls = [...new Set([...Object.keys(vendorCatalog), ...Object.keys(vendorRules)])].reduce((sum, tool) => {
    const vendor = getVendorConfig(tool);
    if (!vendor.subscription || vendor.billingStatus != "active" || !vendor.expectedAmount) return sum;
    return sum + (vendor.billingCurrency === "ILS" ? vendor.expectedAmount : convertUsdToIls(vendor.expectedAmount, raw.usd_rate));
  }, 0);

  const currentMonthTransactions = transactions.filter(
    (transaction) => transaction.monthKey === raw.current_month,
  );

  const unexpectedCharges = currentMonthTransactions.filter((transaction) => {
    const vendor = getVendorConfig(transaction.tool);
    return (
      transaction.type === "one-time" ||
      transaction.source === "manual" ||
      (vendor.billingStatus === "active" && vendor.expectedAmount
        ? vendor.billingCurrency === "ILS"
          ? transaction.amountIls > vendor.expectedAmount * 1.35
          : transaction.amountUsd > vendor.expectedAmount * 1.35
        : false)
    );
  }).length;

  const monthlyIls = raw.monthly_ils ?? Object.fromEntries(
    Object.entries(raw.monthly).map(([key, total]) => [key, convertUsdToIls(total, raw.usd_rate)]),
  );

  const monthlySeries = Object.entries(monthlyIls)
    .map(([key, total]) => ({
      key,
      label: monthLabel(key),
      total,
      budget: DEFAULT_MONTHLY_BUDGET,
      intensity: 0,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

  const maxMonthlyTotal = Math.max(...monthlySeries.map((entry) => entry.total), 1);
  for (const month of monthlySeries) {
    month.intensity = month.total / maxMonthlyTotal;
  }

  const vendorKeys = Object.keys(raw.by_tool_ils ?? raw.by_tool);
  const vendors = vendorKeys
    .map((name) => {
      const config = getVendorConfig(name);
      const vendorTransactions = transactions.filter((transaction) => transaction.tool === name);
      const totalSpend = vendorTransactions.reduce((sum, transaction) => sum + transaction.amountIls, 0);
      return {
        name,
        totalSpend,
        currentMonthSpend: vendorTransactions
          .filter((transaction) => transaction.monthKey === raw.current_month)
          .reduce((sum, transaction) => sum + transaction.amountIls, 0),
        lastChargeDate: vendorTransactions[0]?.date ?? null,
        nextExpectedDate:
          config.subscription && config.billingStatus === "active" && config.billingDay
            ? nextExpectedDate(raw.current_month, config.billingDay)
            : null,
        expectedAmount: config.billingStatus === "active" && config.expectedAmount
          ? config.billingCurrency === "ILS"
            ? config.expectedAmount
            : convertUsdToIls(config.expectedAmount, raw.usd_rate)
          : null,
        recurring: config.subscription ?? false,
        billingStatus: config.billingStatus ?? "one-time",
        source: config.source,
        category: config.category,
        confidence: config.confidence,
        status:
          config.source === "manual" ? "manual" : config.confidence >= 0.9 ? "healthy" : "watch",
        chargeCount: vendorTransactions.length,
        notes: config.notes,
        owner: config.owner,
      } satisfies VendorSummary;
    })
    .sort((left, right) => right.totalSpend - left.totalSpend);

  const needsReview = transactions
    .filter(
      (transaction) =>
        transaction.source === "manual" || transaction.confidence < 0.8 || transaction.type === "one-time",
    )
    .slice(0, 6)
    .map((transaction) => ({
      id: transaction.id,
      vendor: transaction.tool,
      amount: transaction.amountIls,
      date: transaction.date,
      reason:
        transaction.source === "manual"
          ? "החיוב הוזן ידנית ועדיין עוקף את כללי היבוא."
          : transaction.type === "one-time"
            ? "חיוב חד־פעמי או משתנה שדורש אישור מול התקציב."
            : "רמת האמינות של הפענוח נמוכה מסף האישור.",
      severity:
        transaction.amountIls >= convertUsdToIls(40, raw.usd_rate)
          ? "high"
          : transaction.amountIls >= convertUsdToIls(15, raw.usd_rate)
            ? "medium"
            : "low",
    })) satisfies ReviewItem[];

  const auditLog: AuditEvent[] = [
    {
      id: "audit-generated",
      title: "חבילת הדשבורד נבנתה מחדש",
      detail: `נוצר צילום מצב סטטי מהתאריך ${raw.generated}.`,
      timestamp: `${raw.generated} 09:10`,
    },
    {
      id: "audit-openai",
      title: "כלל OpenAI החוזר הורחב",
      detail: "ChatGPT Plus מתווסף אוטומטית בכל 16 לחודש עד סוף השנה.",
      timestamp: `${raw.generated} 08:45`,
    },
    {
      id: "audit-parser",
      title: "מפענח תיבת המייל סונכרן",
      detail: "Gmail, פענוח גוף המייל, חילוץ PDF והייצוא הסטטי נמצאים בתיאום.",
      timestamp: `${raw.generated} 08:20`,
    },
    {
      id: "audit-review",
      title: "תור הבדיקות רוענן",
      detail: `${needsReview.length} חיובים ממתינים להחלטה אנושית.`,
      timestamp: `${raw.generated} 08:05`,
    },
  ];

  const scannerStatus = raw.scanner_status;
  const scannerLastRun = scannerStatus?.last_run
    ? scannerStatus.last_run.replace("T", " ")
    : "טרם רץ";
  const scannerNextRun = scannerStatus?.next_run
    ? scannerStatus.next_run.replace("T", " ")
    : "מחר ב-08:00";
  const scannerStatusBadge: AutomationItem["status"] = scannerStatus?.result === "error"
    ? "watch"
    : "active";
  const scannerDesc = scannerStatus
    ? scannerStatus.result === "error"
      ? `שגיאה: ${scannerStatus.error ?? "לא ידועה"}`
      : scannerStatus.new_count > 0
        ? `נמצאו ${scannerStatus.new_count} חשבוניות חדשות: ${scannerStatus.new_tools.join(", ")}`
        : "סריקה הושלמה — לא נמצאו חשבוניות חדשות"
    : "בודק שולחים, קבצי PDF וגופי חשבוניות ב־HTML. רץ כל יום ב-08:00 (Windows Task Scheduler).";

  const automations: AutomationItem[] = [
    {
      name: "סריקת חשבוניות ב־Gmail",
      cadence: "סריקה יומית ב-08:00",
      status: scannerStatusBadge,
      description: scannerDesc,
      lastRun: scannerLastRun,
      nextRun: scannerNextRun,
    },
    {
      name: "כללי חיוב חוזר",
      cadence: "חודשי לפי יום חיוב מוגדר",
      status: "active",
      description: "מוסיף לדוחות חיובים חוזרים צפויים כמו OpenAI.",
      lastRun: `${raw.generated}`,
      nextRun: "בשינוי הנתונים הבא",
    },
    {
      name: "בנייה מחדש של חוברת האקסל",
      cadence: "עם כל שינוי ב-manual_receipts.json",
      status: "active",
      description: "בונה מחדש את קובץ האקסל ואת נתוני הדשבורד מאותו מקור אמת (GitHub Actions).",
      lastRun: `${raw.generated}`,
      nextRun: "בשינוי הנתונים הבא",
    },
    {
      name: "פרסום ל־GitHub Pages",
      cadence: "קומיט ודחיפה",
      status: "active",
      description: "האתר הסטטי מתפרסם אל docs/ לאחר בניית ה־Next.js. מופעל אוטומטית על-ידי GitHub Actions.",
      lastRun: `${raw.generated}`,
      nextRun: "בבנייה הבאה",
    },
  ];

  const totalYtd = monthlySeries
    .filter((entry) => entry.key.startsWith(currentYear))
    .reduce((sum, entry) => sum + entry.total, 0);

  const settings: SettingsModel = {
    finance: {
      usdRate: raw.usd_rate,
      exchangeRateUpdatedAt: raw.exchange_rate_updated_at ?? null,
      exchangeRateSource: raw.exchange_rate_source ?? "Bank of Israel Public API",
      defaultBillingDay: 16,
      monthlyBudget: DEFAULT_MONTHLY_BUDGET,
    },
    detection: {
      scanWindowDays: 90,
      parserMode: "balanced",
      ignoredSenders: ["facebookmail.com", "mailer-daemon@googlemail.com"],
    },
    vendors: {
      knownVendors: vendors.map((vendor) => vendor.name),
      manualOnlyVendors: vendors.filter((vendor) => vendor.source === "manual").map((vendor) => vendor.name),
    },
    recurringRules: {
      openAiEnabled: true,
      autopublishEnabled: true,
      rebuildDashboardOnChange: true,
    },
  };

  return {
    raw,
    transactions,
    monthlySeries,
    recurringSeries: [
      { label: "חוזר", value: recurringTotalIls, share: recurringTotalUsd / raw.grand_total },
      { label: "חד־פעמי", value: oneTimeTotalIls, share: 1 - recurringTotalUsd / raw.grand_total },
    ],
    vendors,
    automations,
    auditLog,
    needsReview,
    settings,
    stats: {
      totalYtd,
      currentMonth: raw.current_month_total_ils,
      recurringBaseline: recurringBaselineIls,
      unexpectedCharges,
      recurringShare: recurringTotalUsd / raw.grand_total,
    },
  };
});

export function getSourceLabel(source: TransactionSource) {
  return sourceLabel(source);
}

export function getBillingStatusLabel(status: BillingStatus) {
  return billingStatusLabel(status);
}

export const getMonthReports = cache((): ReportMonth[] => {
  const model = getDashboardModel();
  const orderedMonths = [...model.monthlySeries].sort((left, right) => left.key.localeCompare(right.key));

  return orderedMonths.map((month, index) => {
    const transactions = model.transactions
      .filter((transaction) => transaction.monthKey === month.key)
      .sort((left, right) => right.date.localeCompare(left.date));
    const recurringTransactions = transactions.filter((transaction) => transaction.type === "recurring");
    const oneTimeTransactions = transactions.filter((transaction) => transaction.type === "one-time");
    const recurringTotal = recurringTransactions.reduce((sum, transaction) => sum + transaction.amountIls, 0);
    const oneTimeTotal = oneTimeTransactions.reduce((sum, transaction) => sum + transaction.amountIls, 0);
    const vendorTotals = new Map<string, { total: number; chargeCount: number }>();

    for (const transaction of transactions) {
      const current = vendorTotals.get(transaction.tool) ?? { total: 0, chargeCount: 0 };
      vendorTotals.set(transaction.tool, {
        total: current.total + transaction.amountIls,
        chargeCount: current.chargeCount + 1,
      });
    }

    return {
      key: month.key,
      label: formatMonthLabel(month.key),
      year: month.key.slice(0, 4),
      total: month.total,
      budget: month.budget,
      variance: month.total - month.budget,
      varianceRatio: month.budget ? month.total / month.budget : 0,
      transactionCount: transactions.length,
      recurringCount: recurringTransactions.length,
      oneTimeCount: oneTimeTransactions.length,
      recurringTotal,
      oneTimeTotal,
      needsReviewCount: transactions.filter(
        (transaction) => transaction.source === "manual" || transaction.confidence < 0.8 || transaction.type === "one-time",
      ).length,
      transactions,
      topVendors: [...vendorTotals.entries()]
        .map(([name, value]) => ({
          name,
          total: value.total,
          chargeCount: value.chargeCount,
        }))
        .sort((left, right) => right.total - left.total)
        .slice(0, 5),
      previousMonthKey: index > 0 ? orderedMonths[index - 1].key : null,
      nextMonthKey: index < orderedMonths.length - 1 ? orderedMonths[index + 1].key : null,
    } satisfies ReportMonth;
  });
});

export const getReportYears = cache((): string[] => {
  const years = new Set(getMonthReports().map((month) => month.year));
  return [...years].sort((left, right) => right.localeCompare(left));
});

export function getMonthReport(monthKey: string) {
  return getMonthReports().find((month) => month.key === monthKey) ?? null;
}

export function getYearReport(year: string): ReportYear | null {
  const months = getMonthReports().filter((month) => month.year === year);

  if (!months.length) return null;

  const vendorTotals = new Map<string, { total: number; chargeCount: number }>();
  for (const month of months) {
    for (const transaction of month.transactions) {
      const current = vendorTotals.get(transaction.tool) ?? { total: 0, chargeCount: 0 };
      vendorTotals.set(transaction.tool, {
        total: current.total + transaction.amountIls,
        chargeCount: current.chargeCount + 1,
      });
    }
  }

  return {
    year,
    total: months.reduce((sum, month) => sum + month.total, 0),
    budget: months.reduce((sum, month) => sum + month.budget, 0),
    variance: months.reduce((sum, month) => sum + month.variance, 0),
    monthCount: months.length,
    recurringTotal: months.reduce((sum, month) => sum + month.recurringTotal, 0),
    oneTimeTotal: months.reduce((sum, month) => sum + month.oneTimeTotal, 0),
    months: [...months].sort((left, right) => right.key.localeCompare(left.key)),
    topVendors: [...vendorTotals.entries()]
      .map(([name, value]) => ({
        name,
        total: value.total,
        chargeCount: value.chargeCount,
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 8),
  };
}
