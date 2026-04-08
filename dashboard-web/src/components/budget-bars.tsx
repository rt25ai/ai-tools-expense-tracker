import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { formatCurrencyIls } from "@/lib/formatters";
import { monthReportHref } from "@/lib/report-links";
import { cn } from "@/lib/utils";

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
        const variance = month.total - month.budget;
        const overBudget = variance > 0;

        return (
          <div key={month.key} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <Link
                  href={monthReportHref(month.key)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100 transition-colors hover:text-cyan-200"
                >
                  <span>{month.label}</span>
                  <ArrowUpLeft className="size-4" />
                </Link>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {overBudget ? "חריגה לעומת היעד החודשי" : "נשאר בתוך מסגרת היעד"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-zinc-300">{formatCurrencyIls(month.total)}</span>
                <span className="text-zinc-600">מתוך</span>
                <span className="text-zinc-400">{formatCurrencyIls(month.budget)}</span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    overBudget
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                      : "border-cyan-400/15 bg-cyan-400/10 text-cyan-200",
                  )}
                >
                  {overBudget ? `+${formatCurrencyIls(Math.abs(variance))}` : `-${formatCurrencyIls(Math.abs(variance))}`}
                </span>
              </div>
            </div>
            <div className="mt-4 relative h-3 rounded-full bg-white/[0.05]">
              <div className="absolute inset-y-0 right-0 rounded-full bg-zinc-700/70" style={{ width: budgetWidth }} />
              <div
                className={cn(
                  "absolute inset-y-0 right-0 rounded-full",
                  overBudget ? "bg-gradient-to-l from-amber-300 to-cyan-300" : "bg-cyan-400",
                )}
                style={{ width: totalWidth }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
