import Link from "next/link";
import { ChartFrame } from "@/components/chart-frame";
import { CompositionDonutChart } from "@/components/composition-donut-chart";
import { PageHeader } from "@/components/page-header";
import { RankingBarChart } from "@/components/ranking-bar-chart";
import { VendorRuleEditor } from "@/components/vendor-rule-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getChartColor } from "@/lib/chart-palette";
import { getBillingStatusLabel, getDashboardModel, getSourceLabel, getVendorRules } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatDateLabel, formatMonthLabel } from "@/lib/formatters";
import { monthReportHref } from "@/lib/report-links";

function billingTone(status: "active" | "stopped" | "one-time") {
  switch (status) {
    case "active":
      return "border-cyan-400/15 bg-cyan-400/8 text-cyan-200";
    case "stopped":
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    default:
      return "border-white/10 bg-white/[0.05] text-zinc-300";
  }
}

export default function VendorsPage() {
  const model = getDashboardModel();
  const vendorRules = getVendorRules();
  const activeSubscriptions = model.vendors.filter((vendor) => vendor.billingStatus === "active").length;
  const currentMonthLabel = formatMonthLabel(model.raw.current_month);
  const categoryTotals = new Map<string, number>();

  for (const vendor of model.vendors) {
    categoryTotals.set(vendor.category, (categoryTotals.get(vendor.category) ?? 0) + vendor.totalSpend);
  }

  const categorySpendData = [...categoryTotals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([label, value], index) => ({
      label,
      value,
      color: getChartColor(index),
    }));
  const topVendorData = model.vendors.slice(0, 8).map((vendor, index) => ({
    label: vendor.name,
    value: vendor.totalSpend,
    color: getChartColor(index),
  }));

  return (
    <>
      <PageHeader
        eyebrow="ספקים"
        title="רישום ספקים ובריאות חיובים"
        actions={<Button className="bg-cyan-400 text-black hover:bg-cyan-300">בדוק כללי ספקים</Button>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">ספקים במעקב</p>
          <p className="mt-4 text-3xl font-semibold text-white">{model.vendors.length}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">מנויים פעילים</p>
          <p className="mt-4 text-3xl font-semibold text-white">{activeSubscriptions}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">ספקים ידניים / לבדיקה</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {model.vendors.filter((vendor) => vendor.status !== "healthy").length}
          </p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <ChartFrame
          eyebrow="קטגוריות"
          title="איפה הכסף מתרכז לפי סוג כלי"
        >
          <CompositionDonutChart data={categorySpendData} centerLabel="פילוח קטגוריות" />
        </ChartFrame>

        <ChartFrame
          eyebrow="ספקים מובילים"
          title="דירוג הספקים לפי הוצאה מצטברת"
        >
          <RankingBarChart data={topVendorData} valueLabel="הוצאה מצטברת" />
        </ChartFrame>
      </section>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-white/6 pb-6">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-zinc-500">רישום</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">מסך ספקים</h2>
          </div>
          <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
            מבוסס חוקים משותפים
          </Badge>
        </div>
        <div className="space-y-4">
          {model.vendors.map((vendor) => (
            <div key={vendor.name} className="grid gap-5 rounded-[26px] border border-white/8 bg-black/20 p-5 xl:grid-cols-[1.5fr_0.95fr_0.95fr_1fr]">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-lg font-semibold text-white">{vendor.name}</p>
                  <Badge variant="outline" className={billingTone(vendor.billingStatus)}>
                    {getBillingStatusLabel(vendor.billingStatus)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      vendor.status === "healthy"
                        ? "border-cyan-400/15 bg-cyan-400/8 text-cyan-200"
                        : vendor.status === "watch"
                          ? "border-amber-400/15 bg-amber-400/8 text-amber-200"
                          : "border-white/10 bg-white/[0.05] text-zinc-300"
                    }
                  >
                    {vendor.status === "healthy" ? "תקין" : vendor.status === "watch" ? "לבדיקה" : "ידני"}
                  </Badge>
                  <VendorRuleEditor
                    vendorName={vendor.name}
                    initialRule={vendorRules[vendor.name] ?? {}}
                  />
                </div>
                <p className="mt-2 text-sm text-zinc-500">{vendor.category}</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">{vendor.notes}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-zinc-500">מצב מסחרי</p>
                <p className="text-sm text-zinc-100">{getBillingStatusLabel(vendor.billingStatus)}</p>
                <p className="text-sm text-zinc-400">
                  צפוי: {vendor.expectedAmount ? formatCurrencyIls(vendor.expectedAmount) : vendor.billingStatus === "stopped" ? "אין תחזית עתידית" : "משתנה"}
                </p>
                <p className="text-sm text-zinc-400">
                  <Link href={monthReportHref(model.raw.current_month)} className="text-cyan-200 transition-colors hover:text-cyan-100">
                    {currentMonthLabel}
                  </Link>
                  : {formatCurrencyIls(vendor.currentMonthSpend)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-zinc-500">נתונים תפעוליים</p>
                <p className="text-sm text-zinc-100">{getSourceLabel(vendor.source)}</p>
                <p className="text-sm text-zinc-400">אמינות: {Math.round(vendor.confidence * 100)}%</p>
                <p className="text-sm text-zinc-400">אחראי: {vendor.owner}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-zinc-500">חיוב אחרון</p>
                <p className="text-sm text-zinc-100">
                  {vendor.lastChargeDate ? formatDateLabel(vendor.lastChargeDate) : "עדיין אין חיוב"}
                </p>
                <p className="text-sm text-zinc-400">
                  חיוב צפוי הבא: {vendor.nextExpectedDate ? formatDateLabel(vendor.nextExpectedDate) : vendor.billingStatus === "stopped" ? "מנוי הופסק" : "לא מתוזמן"}
                </p>
                <p className="text-sm text-cyan-200">סך הכל: {formatCurrencyIls(vendor.totalSpend)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </>
  );
}
