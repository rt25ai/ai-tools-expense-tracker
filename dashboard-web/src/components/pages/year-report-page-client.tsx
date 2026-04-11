"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { BudgetTrendChart } from "@/components/budget-trend-chart";
import { ChartFrame } from "@/components/chart-frame";
import { PageHeader } from "@/components/page-header";
import { VendorChargeBreakdown } from "@/components/vendor-charge-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ReportYear } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatMonthLabel } from "@/lib/formatters";
import { applyMonthlyBudgetToYearReport, DEFAULT_MONTHLY_BUDGET } from "@/lib/monthly-budget";
import { monthReportHref } from "@/lib/report-links";
import { useMonthlyBudget } from "@/lib/use-monthly-budget";

type VendorChargeBreakdownData = {
  name: string;
  total: number;
  chargeCount: number;
  charges: {
    id: string;
    date: string;
    amountIls: number;
    description: string;
    monthKey: string;
    monthLabel: string;
    monthHref: string;
  }[];
}[];

export function YearReportPageClient({
  report,
  vendorChargeBreakdown,
}: {
  report: ReportYear;
  vendorChargeBreakdown: VendorChargeBreakdownData;
}) {
  const monthlyBudget = useMonthlyBudget(DEFAULT_MONTHLY_BUDGET);
  const budgetedReport = useMemo(
    () => applyMonthlyBudgetToYearReport(report, monthlyBudget),
    [report, monthlyBudget],
  );
  const trendData = useMemo(
    () =>
      budgetedReport.months
        .slice()
        .reverse()
        .map((month) => ({
          label: formatMonthLabel(month.key, "short"),
          total: month.total,
          budget: month.budget,
        })),
    [budgetedReport.months],
  );
  return (
    <>
      <PageHeader
        eyebrow="דוח שנתי"
        title={`סיכום ${report.year}`}
        actions={
          <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
            <Link href="/reports">
              חזרה לארכיון
              <ArrowUpLeft className="size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">סך הוצאות שנתי</p>
          <p className="mt-4 text-3xl font-semibold text-cyan-200">{formatCurrencyIls(report.total)}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">יעד מצטבר</p>
          <p className="mt-4 text-3xl font-semibold text-white">{formatCurrencyIls(budgetedReport.budget)}</p>
          <p className={`mt-2 text-sm ${budgetedReport.variance > 0 ? "text-amber-200" : "text-zinc-400"}`}>
            {budgetedReport.variance > 0
              ? `חריגה ${formatCurrencyIls(Math.abs(budgetedReport.variance))}`
              : `מרווח ${formatCurrencyIls(Math.abs(budgetedReport.variance))}`}
          </p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">חודשים בדוח</p>
          <p className="mt-4 text-3xl font-semibold text-white">{report.monthCount}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">חלוקה שנתית</p>
          <p className="mt-4 text-sm text-white">חוזר: {formatCurrencyIls(report.recurringTotal)}</p>
          <p className="mt-2 text-sm text-zinc-400">חד-פעמי: {formatCurrencyIls(report.oneTimeTotal)}</p>
        </Card>
      </section>

      <ChartFrame
        eyebrow="מגמה שנתית"
        title="בפועל מול היעד, חודש אחרי חודש"
      >
        <BudgetTrendChart data={trendData} />
      </ChartFrame>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">חודשים</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">כל חודשי {report.year}</h2>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              כל חודש לחיץ
            </Badge>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {budgetedReport.months.map((month) => (
              <Link
                key={month.key}
                href={monthReportHref(month.key)}
                className="rounded-[24px] border border-white/8 bg-black/20 p-4 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{month.label}</p>
                    <p className="mt-1 text-sm text-zinc-500">{month.transactionCount} עסקאות</p>
                  </div>
                  <ArrowUpLeft className="size-4 text-cyan-300" />
                </div>
                <p className="mt-4 text-xl font-semibold text-cyan-200">{formatCurrencyIls(month.total)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
                    יעד {formatCurrencyIls(month.budget)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      month.variance > 0
                        ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                        : "border-cyan-400/15 bg-cyan-400/10 text-cyan-200"
                    }
                  >
                    {month.variance > 0
                      ? `חריגה ${formatCurrencyIls(Math.abs(month.variance))}`
                      : `מרווח ${formatCurrencyIls(Math.abs(month.variance))}`}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">ספקים מובילים</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מי הוביל את השנה</h2>
            </div>
          </div>
          <VendorChargeBreakdown vendors={vendorChargeBreakdown} />
        </Card>
      </section>
    </>
  );
}
