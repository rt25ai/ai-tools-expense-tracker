import { formatCurrencyUsd } from "@/lib/formatters";

export function BudgetBars({
  months,
}: {
  months: { key: string; label: string; total: number; budget: number }[];
}) {
  const maxBudget = Math.max(...months.map((month) => Math.max(month.total, month.budget)), 1);

  return (
    <div className="space-y-4">
      {months.map((month) => {
        const totalWidth = `${(month.total / maxBudget) * 100}%`;
        const budgetWidth = `${(month.budget / maxBudget) * 100}%`;

        return (
          <div key={month.key} className="space-y-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <p className="font-medium text-zinc-100">{month.label}</p>
              <div className="flex items-center gap-3 text-zinc-400">
                <span>{formatCurrencyUsd(month.total)}</span>
                <span className="text-zinc-600">/</span>
                <span>{formatCurrencyUsd(month.budget)}</span>
              </div>
            </div>
            <div className="relative h-3 rounded-full bg-white/[0.05]">
              <div className="absolute inset-y-0 left-0 rounded-full bg-zinc-700/70" style={{ width: budgetWidth }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400" style={{ width: totalWidth }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
