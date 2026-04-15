"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpLeft, CheckCircle2, CircleAlert } from "lucide-react";
import { BudgetBars } from "@/components/budget-bars";
import { ChartFrame } from "@/components/chart-frame";
import { CompositionDonutChart } from "@/components/composition-donut-chart";
import { OverviewKpiGrid } from "@/components/overview-kpi-grid";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardModel } from "@/lib/dashboard-data";
import { getChartColor } from "@/lib/chart-palette";
import { formatCurrencyIls, formatDateLabel, formatDateTimeLabel, formatExchangeRate } from "@/lib/formatters";
import { applyMonthlyBudgetToMonths } from "@/lib/monthly-budget";
import { monthReportHref, yearReportHref } from "@/lib/report-links";
import { useMonthlyBudget } from "@/lib/use-monthly-budget";

export function OverviewViewClient({ model }: { model: DashboardModel }) {
  const currentYear = model.raw.current_month.slice(0, 4);
  const monthlyBudget = useMonthlyBudget(model.settings.finance.monthlyBudget);
  const budgetedMonthlySeries = useMemo(
    () => applyMonthlyBudgetToMonths(model.monthlySeries, monthlyBudget),
    [model.monthlySeries, monthlyBudget],
  );
  const latestMonths = useMemo(
    () => [...budgetedMonthlySeries].sort((left, right) => right.key.localeCompare(left.key)).slice(0, 6),
    [budgetedMonthlySeries],
  );
  const compositionData = useMemo(
    () =>
      model.recurringSeries.map((entry, index) => ({
        label: entry.label,
        value: entry.value,
        color: getChartColor(index),
      })),
    [model.recurringSeries],
  );

  return (
    <>
      <PageHeader
        eyebrow="ראשי"
        title="תמונת מצב תפעולית"
        actions={
          <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
            <Link href="/transactions">
              פתח עסקאות
              <ArrowUpLeft className="size-4" />
            </Link>
          </Button>
        }
      />

      <OverviewKpiGrid model={model} />

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex flex-col gap-4 border-b border-white/6 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">דוחות</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מעבר מהיר לחודשים ולשנים</h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
                {budgetedMonthlySeries.length} חודשים במעקב
              </Badge>
              <Button asChild variant="outline" className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]">
                <Link href="/reports">פתח ארכיון דוחות</Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {latestMonths.map((month) => {
              const variance = month.total - month.budget;

              return (
                <Link
                  key={month.key}
                  href={monthReportHref(month.key)}
                  className="rounded-[24px] border border-white/8 bg-black/20 p-4 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{month.label}</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-500">מתוך יעד של {formatCurrencyIls(month.budget)}</p>
                    </div>
                    <ArrowUpLeft className="mt-0.5 size-4 text-cyan-300" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-cyan-200">{formatCurrencyIls(month.total)}</p>
                  <p className={`mt-2 text-sm ${variance > 0 ? "text-amber-200" : "text-zinc-400"}`}>
                    {variance > 0 ? `חריגה של ${formatCurrencyIls(Math.abs(variance))}` : `מתחת ליעד ב-${formatCurrencyIls(Math.abs(variance))}`}
                  </p>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href={yearReportHref(currentYear)}>
                דוח שנתי {currentYear}
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]">
              <Link href={monthReportHref(model.raw.current_month)}>
                דוח החודש הפעיל
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500">תמהיל הוצאות</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">חלוקה צבעונית של מבנה ההוצאה</h2>
          <div className="mt-6">
            <CompositionDonutChart data={compositionData} centerLabel="סה״כ הוצאות" />
          </div>

          <div className="mt-8 rounded-[24px] border border-cyan-400/15 bg-cyan-400/7 p-4">
            <p className="text-sm font-medium text-cyan-100">עדכון שער</p>
            <p className="mt-2 text-sm leading-6 text-cyan-50/80">
              נמשך ע"י המערכת:{" "}
              {model.raw.exchange_rate_fetched_at ? formatDateTimeLabel(model.raw.exchange_rate_fetched_at) : "לא ידוע"}
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              פורסם ע"י בנק ישראל:{" "}
              {model.raw.exchange_rate_updated_at ? formatDateTimeLabel(model.raw.exchange_rate_updated_at) : "לא התקבל"}
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{model.raw.exchange_rate_source ?? "Bank of Israel Public API"}</p>
            <Badge variant="outline" className="mt-3 border-cyan-400/15 bg-cyan-400/8 text-cyan-200">
              {formatExchangeRate(model.raw.usd_rate)}
            </Badge>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">תקציב מול בפועל</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">פער חודשי מהיעד</h2>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              תקציב עבודה
            </Badge>
          </div>
          <div className="mt-6">
            <BudgetBars months={budgetedMonthlySeries.filter((entry) => entry.key.startsWith(currentYear))} />
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">דורש בדיקה</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">תור שמחכה לאישור אנושי</h2>
            </div>
            <Button asChild variant="outline" className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]">
              <Link href="/vendors">פתח מסך ספקים</Link>
            </Button>
          </div>
          <div className="mt-6 space-y-3">
            {model.needsReview.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.vendor}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatDateLabel(item.date)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      item.severity === "high"
                        ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                        : item.severity === "medium"
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                          : "border-sky-400/20 bg-sky-400/10 text-sky-200"
                    }
                  >
                    {item.severity === "high" ? "גבוה" : item.severity === "medium" ? "בינוני" : "נמוך"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{formatCurrencyIls(item.amount)}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{item.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-zinc-500">יומן שינויים אחרון</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">מה השתנה בתהליך</h2>
          </div>
          <Badge variant="outline" className="border-cyan-400/15 bg-cyan-400/8 text-cyan-200">
            {model.raw.generated}
          </Badge>
        </div>
        <div className="mt-6 space-y-4">
          {model.auditLog.map((event) => (
            <div key={event.id} className="flex gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="mt-1 rounded-full border border-cyan-400/15 bg-cyan-400/8 p-2 text-cyan-300">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <p className="font-medium text-white">{event.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{event.detail}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">{event.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
