import { cache } from "react";
import fs from "node:fs";
import path from "node:path";

export type TransactionSource = "manual" | "auto" | "email-imported" | "ai-extracted";
export type ChargeType = "recurring" | "one-time";
export type VendorStatus = "healthy" | "watch" | "manual";

type RawTransaction = {
  date: string;
  tool: string;
  description: string;
  amount: number;
};

type RawDashboardData = {
  generated: string;
  usd_rate: number;
  grand_total: number;
  grand_total_ils: number;
  current_month: string;
  current_month_total: number;
  current_month_total_ils: number;
  transactions: RawTransaction[];
  monthly: Record<string, number>;
  by_tool: Record<string, number>;
};

type VendorConfig = {
  category: string;
  source: TransactionSource;
  recurring: boolean;
  billingDay?: number;
  expectedAmount?: number;
  confidence: number;
  owner: string;
  notes: string;
};

export type EnrichedTransaction = RawTransaction & {
  id: string;
  monthKey: string;
  source: TransactionSource;
  type: ChargeType;
  category: string;
  confidence: number;
};

export type VendorSummary = {
  name: string;
  totalSpend: number;
  currentMonthSpend: number;
  lastChargeDate: string | null;
  nextExpectedDate: string | null;
  expectedAmount: number | null;
  recurring: boolean;
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

const vendorCatalog: Record<string, VendorConfig> = {
  OpenAI: {
    category: "AI model",
    source: "auto",
    recurring: true,
    billingDay: 16,
    expectedAmount: 20,
    confidence: 0.99,
    owner: "Finance ops",
    notes: "Recurring ChatGPT Plus rule injected on the 16th through year-end.",
  },
  Anthropic: {
    category: "AI model",
    source: "email-imported",
    recurring: true,
    billingDay: 15,
    expectedAmount: 20,
    confidence: 0.92,
    owner: "Finance ops",
    notes: "Primary Claude subscription, sometimes with extra credit top-ups.",
  },
  "Google Workspace": {
    category: "Workspace",
    source: "email-imported",
    recurring: true,
    billingDay: 2,
    expectedAmount: 20.79,
    confidence: 0.97,
    owner: "Ops",
    notes: "Imported from Gmail and normalized from ILS to USD.",
  },
  CapCut: {
    category: "Video",
    source: "email-imported",
    recurring: true,
    billingDay: 10,
    expectedAmount: 13.67,
    confidence: 0.89,
    owner: "Creative",
    notes: "Pulled from invoice links in email bodies.",
  },
  "Eleven Labs": {
    category: "Voice",
    source: "email-imported",
    recurring: true,
    billingDay: 30,
    expectedAmount: 11,
    confidence: 0.9,
    owner: "Creative",
    notes: "Monthly subscription with occasional plan changes.",
  },
  Make: {
    category: "Automation",
    source: "email-imported",
    recurring: true,
    billingDay: 10,
    expectedAmount: 10.59,
    confidence: 0.94,
    owner: "Ops",
    notes: "Core workflow automation spend.",
  },
  Manychat: {
    category: "Automation",
    source: "email-imported",
    recurring: true,
    billingDay: 3,
    expectedAmount: 15,
    confidence: 0.91,
    owner: "Growth",
    notes: "Chat funnel automation plan.",
  },
  Timeless: {
    category: "Video",
    source: "manual",
    recurring: true,
    billingDay: 1,
    expectedAmount: 14.5,
    confidence: 0.8,
    owner: "Creative",
    notes: "Manual recurring entry, discounted plan.",
  },
  Lovable: {
    category: "Builder",
    source: "manual",
    recurring: true,
    billingDay: 25,
    expectedAmount: 25,
    confidence: 0.73,
    owner: "Build",
    notes: "Variable subscription and top-up spend. Watch for plan drift.",
  },
  "Runway ML": {
    category: "Video",
    source: "email-imported",
    recurring: false,
    confidence: 0.86,
    owner: "Creative",
    notes: "Imported usage and credit packs.",
  },
  Replicate: {
    category: "Compute",
    source: "email-imported",
    recurring: false,
    confidence: 0.9,
    owner: "Build",
    notes: "Usage-based compute charges.",
  },
  Recraft: {
    category: "Design",
    source: "email-imported",
    recurring: false,
    confidence: 0.9,
    owner: "Creative",
    notes: "Credits and plan changes imported from email.",
  },
  "Ideogram AI": {
    category: "Design",
    source: "email-imported",
    recurring: false,
    confidence: 0.96,
    owner: "Creative",
    notes: "Annual and upgrade charges imported from inbox.",
  },
  Genspark: {
    category: "AI model",
    source: "email-imported",
    recurring: false,
    confidence: 0.9,
    owner: "R&D",
    notes: "Annual plan and ad-hoc credits.",
  },
  "Meta (Ads)": {
    category: "Paid media",
    source: "manual",
    recurring: false,
    confidence: 0.68,
    owner: "Growth",
    notes: "Manual ad-spend capture. Candidate for direct API sync later.",
  },
  IONOS: {
    category: "Domains",
    source: "manual",
    recurring: false,
    confidence: 0.75,
    owner: "Ops",
    notes: "Domain purchase added manually.",
  },
  "Manus AI": {
    category: "AI model",
    source: "manual",
    recurring: true,
    billingDay: 9,
    expectedAmount: 19,
    confidence: 0.67,
    owner: "R&D",
    notes: "Legacy manual entry, not yet wired to inbox detection.",
  },
  Higgsfield: {
    category: "Video",
    source: "email-imported",
    recurring: false,
    confidence: 0.84,
    owner: "Creative",
    notes: "One-off credit pack imported from invoice PDF.",
  },
  Astria: {
    category: "Image generation",
    source: "manual",
    recurring: false,
    confidence: 0.72,
    owner: "Creative",
    notes: "One-time credit purchase.",
  },
  Hedra: {
    category: "Video",
    source: "manual",
    recurring: false,
    confidence: 0.7,
    owner: "Creative",
    notes: "Manual credit-pack capture.",
  },
};

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
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
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
      return "Auto";
    case "manual":
      return "Manual";
    case "ai-extracted":
      return "AI extracted";
    default:
      return "Email imported";
  }
}

function vendorFallback(tool: string): VendorConfig {
  return {
    category: "Unclassified",
    source: "manual",
    recurring: false,
    confidence: 0.55,
    owner: "Finance ops",
    notes: `No explicit vendor rule yet for ${tool}.`,
  };
}

export const getDashboardModel = cache((): DashboardModel => {
  const raw = readRawData();
  const currentYear = raw.current_month.slice(0, 4);

  const transactions = raw.transactions.map((transaction, index) => {
    const config = vendorCatalog[transaction.tool] ?? vendorFallback(transaction.tool);
    return {
      ...transaction,
      id: `${transaction.date}-${transaction.tool}-${index}`,
      description: sanitizeText(cleanText(transaction.description)),
      monthKey: transaction.date.slice(0, 7),
      source: config.source,
      type: config.recurring ? "recurring" : "one-time",
      category: config.category,
      confidence: config.confidence,
    } satisfies EnrichedTransaction;
  });

  const recurringTotal = transactions
    .filter((transaction) => transaction.type === "recurring")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const oneTimeTotal = Math.max(raw.grand_total - recurringTotal, 0);
  const recurringBaseline = Object.values(vendorCatalog).reduce((sum, vendor) => {
    return sum + (vendor.recurring && vendor.expectedAmount ? vendor.expectedAmount : 0);
  }, 0);

  const currentMonthTransactions = transactions.filter(
    (transaction) => transaction.monthKey === raw.current_month,
  );

  const unexpectedCharges = currentMonthTransactions.filter((transaction) => {
    const vendor = vendorCatalog[transaction.tool] ?? vendorFallback(transaction.tool);
    return (
      transaction.type === "one-time" ||
      transaction.source === "manual" ||
      (vendor.expectedAmount ? transaction.amount > vendor.expectedAmount * 1.35 : false)
    );
  }).length;

  const monthlySeries = Object.entries(raw.monthly).map(([key, total]) => ({
    key,
    label: monthLabel(key),
    total,
    budget: recurringBaseline + (key >= raw.current_month ? 36 : 88),
    intensity: 0,
  }));

  const maxMonthlyTotal = Math.max(...monthlySeries.map((entry) => entry.total), 1);
  for (const month of monthlySeries) {
    month.intensity = month.total / maxMonthlyTotal;
  }

  const vendors = Object.entries(raw.by_tool)
    .map(([name, totalSpend]) => {
      const config = vendorCatalog[name] ?? vendorFallback(name);
      const vendorTransactions = transactions.filter((transaction) => transaction.tool === name);
      return {
        name,
        totalSpend,
        currentMonthSpend: vendorTransactions
          .filter((transaction) => transaction.monthKey === raw.current_month)
          .reduce((sum, transaction) => sum + transaction.amount, 0),
        lastChargeDate: vendorTransactions[0]?.date ?? null,
        nextExpectedDate:
          config.recurring && config.billingDay
            ? nextExpectedDate(raw.current_month, config.billingDay)
            : null,
        expectedAmount: config.expectedAmount ?? null,
        recurring: config.recurring,
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
      amount: transaction.amount,
      date: transaction.date,
      reason:
        transaction.source === "manual"
          ? "Manual entry still bypasses importer rules."
          : transaction.type === "one-time"
            ? "One-time or variable charge should be confirmed against budget."
            : "Parsing confidence is below the review threshold.",
      severity:
        transaction.amount >= 40 ? "high" : transaction.amount >= 15 ? "medium" : "low",
    })) satisfies ReviewItem[];

  const auditLog: AuditEvent[] = [
    {
      id: "audit-generated",
      title: "Dashboard bundle regenerated",
      detail: `Static data snapshot built from ${raw.generated}.`,
      timestamp: `${raw.generated} 09:10`,
    },
    {
      id: "audit-openai",
      title: "Recurring OpenAI rule extended",
      detail: "ChatGPT Plus is injected on the 16th through year-end.",
      timestamp: `${raw.generated} 08:45`,
    },
    {
      id: "audit-parser",
      title: "Inbox parser synced",
      detail: "Gmail, body parsing, PDF extraction, and static export are aligned.",
      timestamp: `${raw.generated} 08:20`,
    },
    {
      id: "audit-review",
      title: "Review queue refreshed",
      detail: `${needsReview.length} charges are waiting for an operator decision.`,
      timestamp: `${raw.generated} 08:05`,
    },
  ];

  const automations: AutomationItem[] = [
    {
      name: "Gmail invoice scan",
      cadence: "Daily scan over the last 90 days",
      status: "active",
      description: "Checks inbox senders, PDFs, and HTML invoice bodies.",
      lastRun: `${raw.generated} 07:15`,
      nextRun: `${raw.generated} 19:15`,
    },
    {
      name: "Recurring charge rules",
      cadence: "Monthly at defined billing day",
      status: "active",
      description: "Injects expected recurring charges like OpenAI into the reporting layer.",
      lastRun: `${raw.generated} 07:17`,
      nextRun: "2026-04-16 00:05",
    },
    {
      name: "Workbook rebuild",
      cadence: "On report refresh",
      status: "active",
      description: "Rebuilds Excel and derived dashboard data from the same source of truth.",
      lastRun: `${raw.generated} 07:18`,
      nextRun: "On next data change",
    },
    {
      name: "GitHub Pages publish",
      cadence: "Commit + push",
      status: "semi-auto",
      description: "Static site is published to docs/ after the Next.js export build.",
      lastRun: `${raw.generated} 07:20`,
      nextRun: "On next build",
    },
  ];

  const totalYtd = monthlySeries
    .filter((entry) => entry.key.startsWith(currentYear))
    .reduce((sum, entry) => sum + entry.total, 0);

  const settings: SettingsModel = {
    finance: {
      usdRate: raw.usd_rate,
      defaultBillingDay: 16,
      monthlyBudget: Math.round(recurringBaseline + 90),
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
      { label: "Recurring", value: recurringTotal, share: recurringTotal / raw.grand_total },
      { label: "One-time", value: oneTimeTotal, share: oneTimeTotal / raw.grand_total },
    ],
    vendors,
    automations,
    auditLog,
    needsReview,
    settings,
    stats: {
      totalYtd,
      currentMonth: raw.current_month_total,
      recurringBaseline,
      unexpectedCharges,
      recurringShare: recurringTotal / raw.grand_total,
    },
  };
});

export function getSourceLabel(source: TransactionSource) {
  return sourceLabel(source);
}
