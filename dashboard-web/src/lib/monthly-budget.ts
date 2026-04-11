export const DASHBOARD_SETTINGS_STORAGE_KEY = "rt-ai-console-settings";
export const DASHBOARD_SETTINGS_UPDATED_EVENT = "rt-ai-settings-updated";
export const DEFAULT_MONTHLY_BUDGET = 700;

type BudgetEntry = {
  total: number;
  budget: number;
  variance?: number;
  varianceRatio?: number;
};

type YearBudgetReport<TMonth extends BudgetEntry> = {
  total: number;
  budget: number;
  variance: number;
  monthCount: number;
  months: TMonth[];
};

export function sanitizeMonthlyBudget(value: unknown, fallback = DEFAULT_MONTHLY_BUDGET) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function applyMonthlyBudget<TEntry extends BudgetEntry>(entry: TEntry, monthlyBudget: number): TEntry {
  const normalizedBudget = sanitizeMonthlyBudget(monthlyBudget);

  return {
    ...entry,
    budget: normalizedBudget,
    variance: entry.total - normalizedBudget,
    varianceRatio: normalizedBudget ? entry.total / normalizedBudget : 0,
  };
}

export function applyMonthlyBudgetToMonths<TEntry extends BudgetEntry>(months: TEntry[], monthlyBudget: number) {
  return months.map((month) => applyMonthlyBudget(month, monthlyBudget));
}

export function applyMonthlyBudgetToYearReport<
  TMonth extends BudgetEntry,
  TReport extends YearBudgetReport<TMonth>,
>(report: TReport, monthlyBudget: number): TReport {
  const normalizedBudget = sanitizeMonthlyBudget(monthlyBudget);
  const months = applyMonthlyBudgetToMonths(report.months, normalizedBudget);
  const totalBudget = normalizedBudget * months.length;

  return {
    ...report,
    months,
    budget: totalBudget,
    variance: report.total - totalBudget,
  };
}
