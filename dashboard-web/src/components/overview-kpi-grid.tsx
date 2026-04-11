"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, CalendarClock, CircleAlert, RefreshCw } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { VendorChargeBreakdown } from "@/components/vendor-charge-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardModel } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatDateLabel, formatMonthLabel } from "@/lib/formatters";
import { monthReportHref, yearReportHref } from "@/lib/report-links";

type KpiKey = "totalYtd" | "currentMonth" | "recurringBaseline" | "needsReview";

function groupTransactionsByVendor(transactions: DashboardModel["transactions"]) {
  const vendors = new Map<
    string,
    {
      name: string;
      total: number;
      chargeCount: number;
      charges: {
        id: string;
        date: string;
        amountIls: number;
        description: string;
      }[];
    }
  >();

  for (const transaction of transactions) {
    const existingVendor = vendors.get(transaction.tool);
    const charge = {
      id: transaction.id,
      date: transaction.date,
      amountIls: transaction.amountIls,
      description: transaction.description,
    };

    if (existingVendor) {
      existingVendor.total += transaction.amountIls;
      existingVendor.chargeCount += 1;
      existingVendor.charges.push(charge);
      continue;
    }

    vendors.set(transaction.tool, {
      name: transaction.tool,
      total: transaction.amountIls,
      chargeCount: 1,
      charges: [charge],
    });
  }

  return [...vendors.values()];
}

function DetailShell({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border-cyan-400/15 bg-cyan-400/[0.05] p-5 shadow-none">
      <div className="flex flex-col gap-4 border-b border-white/8 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-cyan-200/80">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{title}</h3>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function OverviewKpiGrid({ model }: { model: DashboardModel }) {
  const [activeKpi, setActiveKpi] = useState<KpiKey>("currentMonth");
  const currentMonthTransactions = model.transactions.filter((transaction) => transaction.monthKey === model.raw.current_month);
  const currentMonthChargeBreakdown = groupTransactionsByVendor(currentMonthTransactions);
  const recurringVendors = model.vendors.filter((vendor) => vendor.billingStatus === "active");
  const currentYear = model.raw.current_month.slice(0, 4);
  const currentMonthLabel = formatMonthLabel(model.raw.current_month);

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="סך מתחילת השנה"
          value={formatCurrencyIls(model.stats.totalYtd)}
          active={activeKpi === "totalYtd"}
          onClick={() => setActiveKpi("totalYtd")}
        />
        <KpiCard
          label="החודש הנוכחי"
          value={formatCurrencyIls(model.stats.currentMonth)}
          active={activeKpi === "currentMonth"}
          onClick={() => setActiveKpi("currentMonth")}
        />
        <KpiCard
          label="בסיס חודשי קבוע"
          value={formatCurrencyIls(model.stats.recurringBaseline)}
          active={activeKpi === "recurringBaseline"}
          onClick={() => setActiveKpi("recurringBaseline")}
        />
        <KpiCard
          label="חיובים לבדיקה"
          value={String(model.stats.unexpectedCharges)}
          active={activeKpi === "needsReview"}
          onClick={() => setActiveKpi("needsReview")}
        />
      </div>

      {activeKpi === "totalYtd" ? (
        <DetailShell
          eyebrow="פירוט שנתי"
          title={`הסיכום של ${currentYear}`}
          action={
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href={yearReportHref(currentYear)}>
                פתח דוח שנתי
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {model.vendors.slice(0, 6).map((vendor) => (
              <div key={vendor.name} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{vendor.name}</p>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-zinc-200">
                    {vendor.chargeCount} חיובים
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-500">{vendor.category}</p>
                <p className="mt-3 text-lg font-semibold text-cyan-200">{formatCurrencyIls(vendor.totalSpend)}</p>
                <p className="mt-2 text-sm text-zinc-400">
                  חיוב אחרון: {vendor.lastChargeDate ? formatDateLabel(vendor.lastChargeDate) : "עדיין אין"}
                </p>
              </div>
            ))}
          </div>
        </DetailShell>
      ) : null}

      {activeKpi === "currentMonth" ? (
        <DetailShell
          eyebrow="פירוט חודשי"
          title={`החיובים של ${currentMonthLabel}`}
          action={
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href={monthReportHref(model.raw.current_month)}>
                פתח דוח חודשי
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          }
        >
          {currentMonthChargeBreakdown.length ? (
            <VendorChargeBreakdown vendors={currentMonthChargeBreakdown} />
          ) : (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-zinc-400">
              אין חיובים בחודש הנוכחי.
            </div>
          )}
        </DetailShell>
      ) : null}

      {activeKpi === "recurringBaseline" ? (
        <DetailShell
          eyebrow="בסיס קבוע"
          title="החיובים החוזרים שצפויים בכל חודש"
          action={
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href="/vendors">
                בדוק ספקים חוזרים
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            {recurringVendors.map((vendor) => (
              <div key={vendor.name} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{vendor.name}</p>
                  <Badge variant="outline" className="border-cyan-400/15 bg-cyan-400/10 text-cyan-200">
                    {vendor.nextExpectedDate ? `חיוב הבא ${formatDateLabel(vendor.nextExpectedDate)}` : "ללא תזמון"}
                  </Badge>
                </div>
                <p className="mt-3 text-lg font-semibold text-cyan-200">
                  {vendor.expectedAmount ? formatCurrencyIls(vendor.expectedAmount) : "משתנה"}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  מקור:{" "}
                  {vendor.source === "auto"
                    ? "אוטומטי"
                    : vendor.source === "manual"
                      ? "ידני"
                      : vendor.source === "email-imported"
                        ? "מיובא מהמייל"
                        : "חולץ ב-AI"}
                </p>
              </div>
            ))}
          </div>
        </DetailShell>
      ) : null}

      {activeKpi === "needsReview" ? (
        <DetailShell
          eyebrow="בדיקה ידנית"
          title="הפריטים שדורשים החלטה אנושית"
          action={
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href="/transactions">
                עבור לטבלת העסקאות
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          }
        >
          <div className="space-y-3">
            {model.needsReview.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-[22px] border border-white/8 bg-black/20 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-full border border-amber-400/15 bg-amber-400/10 p-2 text-amber-200">
                    {item.severity === "high" ? (
                      <CircleAlert className="size-4" />
                    ) : item.severity === "medium" ? (
                      <RefreshCw className="size-4" />
                    ) : (
                      <CalendarClock className="size-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">{item.vendor}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatDateLabel(item.date)}</p>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.reason}</p>
                  </div>
                </div>
                <div className="text-right">
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
                  <p className="mt-3 text-lg font-semibold text-cyan-200">{formatCurrencyIls(item.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        </DetailShell>
      ) : null}
    </section>
  );
}
