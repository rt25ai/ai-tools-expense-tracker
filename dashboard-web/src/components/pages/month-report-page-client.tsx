"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpLeft } from "lucide-react";
import { ChartFrame } from "@/components/chart-frame";
import { CompositionDonutChart } from "@/components/composition-donut-chart";
import { PageHeader } from "@/components/page-header";
import { RankingBarChart } from "@/components/ranking-bar-chart";
import { TransactionsTable } from "@/components/transactions-table";
import { VendorChargeBreakdown } from "@/components/vendor-charge-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getChartColor } from "@/lib/chart-palette";
import type { ReportMonth } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatMonthLabel } from "@/lib/formatters";
import { applyMonthlyBudget, DEFAULT_MONTHLY_BUDGET } from "@/lib/monthly-budget";
import { monthReportHref, yearReportHref } from "@/lib/report-links";
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
  }[];
}[];

export function MonthReportPageClient({
  report,
  vendorChargeBreakdown,
}: {
  report: ReportMonth;
  vendorChargeBreakdown: VendorChargeBreakdownData;
}) {
  const monthlyBudget = useMonthlyBudget(DEFAULT_MONTHLY_BUDGET);
  const budgetedReport = useMemo(() => applyMonthlyBudget(report, monthlyBudget), [report, monthlyBudget]);
  const compositionData = useMemo(
    () => [
      { label: "חוזר", value: report.recurringTotal, color: getChartColor(0) },
      { label: "חד-פעמי", value: report.oneTimeTotal, color: getChartColor(2) },
    ],
    [report.oneTimeTotal, report.recurringTotal],
  );
  const vendorRankingData = useMemo(
    () =>
      report.topVendors.map((vendor, index) => ({
        label: vendor.name,
        value: vendor.total,
        color: getChartColor(index),
      })),
    [report.topVendors],
  );

  return (
    <>
      <PageHeader
        eyebrow="דוח חודשי"
        title={report.label}
        description="דוח חודשי מלא עם כל העסקאות של החודש, ספקים מובילים, חלוקה בין חיובים חוזרים לחד-פעמיים וניווט לחודשים סמוכים."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]"
            >
              <Link href={yearReportHref(report.year)}>חזרה לדוח {report.year}</Link>
            </Button>
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href="/reports">
                כל הדוחות
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">סך הוצאות החודש</p>
          <p className="mt-4 text-3xl font-semibold text-cyan-200">{formatCurrencyIls(report.total)}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">מול יעד חודשי</p>
          <p className="mt-4 text-3xl font-semibold text-white">{formatCurrencyIls(budgetedReport.budget)}</p>
          <p className={`mt-2 text-sm ${budgetedReport.variance > 0 ? "text-amber-200" : "text-zinc-400"}`}>
            {budgetedReport.variance > 0
              ? `חריגה ${formatCurrencyIls(Math.abs(budgetedReport.variance))}`
              : `מרווח ${formatCurrencyIls(Math.abs(budgetedReport.variance))}`}
          </p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">עסקאות בחודש</p>
          <p className="mt-4 text-3xl font-semibold text-white">{report.transactionCount}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {report.recurringCount} חוזרות, {report.oneTimeCount} חד-פעמיות
          </p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">דורש בדיקה</p>
          <p className="mt-4 text-3xl font-semibold text-white">{report.needsReviewCount}</p>
          <p className="mt-2 text-sm text-zinc-400">פריטים עם הזנה ידנית או חריגה</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <ChartFrame
          eyebrow="הרכב חודשי"
          title="איך הסכום מתפרק בתוך החודש"
          description="מפריד בין חיובים חוזרים לבין הוצאות חד-פעמיות, כדי להבין אם החריגה הגיעה מהבסיס הקבוע או ממשהו נקודתי."
        >
          <CompositionDonutChart data={compositionData} centerLabel="חלוקת החודש" />
        </ChartFrame>

        <ChartFrame
          eyebrow="דירוג ספקים"
          title="מי בלט בהוצאה של החודש"
          description="בר אופקי מדגיש את הספקים שדחפו את הסכום כלפי מעלה. הצבעים רק עוזרים לסריקה מהירה, בלי לשנות את הנתון עצמו."
        >
          <RankingBarChart data={vendorRankingData} valueLabel="סך חיובים" />
        </ChartFrame>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">ספקים מובילים</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מי הוביל את ההוצאה בחודש</h2>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              Top {report.topVendors.length}
            </Badge>
          </div>
          <VendorChargeBreakdown vendors={vendorChargeBreakdown} />
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">ניווט חודשי</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מעבר לחודשים סמוכים</h2>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {report.nextMonthKey ? (
              <Link
                href={monthReportHref(report.nextMonthKey)}
                className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >
                <div>
                  <p className="text-sm text-zinc-500">החודש הבא</p>
                  <p className="mt-1 font-medium text-white">{formatMonthLabel(report.nextMonthKey)}</p>
                </div>
                <ArrowLeft className="size-4 text-cyan-300" />
              </Link>
            ) : null}
            {report.previousMonthKey ? (
              <Link
                href={monthReportHref(report.previousMonthKey)}
                className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >
                <div>
                  <p className="text-sm text-zinc-500">החודש הקודם</p>
                  <p className="mt-1 font-medium text-white">{formatMonthLabel(report.previousMonthKey)}</p>
                </div>
                <ArrowRight className="size-4 text-cyan-300" />
              </Link>
            ) : null}
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <p className="text-sm text-zinc-500">חלוקת סכומים</p>
              <p className="mt-2 text-white">חוזר: {formatCurrencyIls(report.recurringTotal)}</p>
              <p className="mt-2 text-zinc-400">חד-פעמי: {formatCurrencyIls(report.oneTimeTotal)}</p>
            </div>
          </div>
        </Card>
      </section>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="mb-6 flex flex-col gap-3 border-b border-white/6 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-zinc-500">עסקאות</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">כל העסקאות של {report.label}</h2>
          </div>
          <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
            {report.transactionCount} שורות
          </Badge>
        </div>
        <TransactionsTable data={report.transactions} />
      </Card>
    </>
  );
}
