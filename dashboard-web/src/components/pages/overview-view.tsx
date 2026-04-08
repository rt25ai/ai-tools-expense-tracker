import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { Heatmap } from "@/components/heatmap";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { BudgetBars } from "@/components/budget-bars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatCurrencyUsd, formatDateLabel } from "@/lib/formatters";

export function OverviewView() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Spend operations at a glance"
        description="A tighter operating surface for finance, recurring charge rules, review work, and vendor health. Built to feel like a real admin console, not a decorative dashboard."
        actions={
          <Button asChild className="bg-emerald-500 text-black hover:bg-emerald-400">
            <Link href="/transactions">
              Open transactions
              <ArrowUpRight className="ml-2 size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total YTD"
          value={formatCurrencyUsd(model.stats.totalYtd)}
          hint="Year-to-date spend across subscriptions, top-ups, ads, and one-off vendor charges."
        />
        <KpiCard
          label="Current month"
          value={formatCurrencyUsd(model.stats.currentMonth)}
          hint={`Equivalent to ${formatCurrencyIls(model.raw.current_month_total_ils)} in the working workbook.`}
        />
        <KpiCard
          label="Recurring baseline"
          value={formatCurrencyUsd(model.stats.recurringBaseline)}
          hint="Expected steady-state monthly burn before variable ads, credit packs, and manual exceptions."
        />
        <KpiCard
          label="Unexpected charges"
          value={String(model.stats.unexpectedCharges)}
          hint="This month's transactions that still need operator review because they are manual, variable, or one-off."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Monthly heatmap</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Budget pressure by month</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                The heatmap replaces the old generic bar-first presentation and makes it easier to spot heavy
                months, future recurring baselines, and spend concentration.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              {model.monthlySeries.length} months tracked
            </Badge>
          </div>
          <div className="mt-6">
            <Heatmap data={model.monthlySeries} />
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Charge profile</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Recurring vs one-time</h2>
          <div className="mt-6 space-y-5">
            {model.recurringSeries.map((entry) => (
              <div key={entry.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-zinc-100">{entry.label}</p>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-100">{formatCurrencyUsd(entry.value)}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {Math.round(entry.share * 100)}%
                    </p>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-white/[0.05]">
                  <div className="h-3 rounded-full bg-emerald-400" style={{ width: `${Math.max(entry.share * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-amber-400/15 bg-amber-400/7 p-4">
            <p className="text-sm font-medium text-amber-100">Operator note</p>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">
              Variable paid-media and manual credits are still the main reason the console needs a review queue.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Budget vs actual</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Monthly operating variance</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Shows how far each month drifted from the working spend target after recurring commitments were layered in.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              Working budget
            </Badge>
          </div>
          <div className="mt-6">
            <BudgetBars months={model.monthlySeries.filter((entry) => entry.key.startsWith("2026"))} />
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Needs review</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Queue that still needs a human</h2>
            </div>
            <Button asChild variant="outline" className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]">
              <Link href="/vendors">Open vendor view</Link>
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
                    {item.severity}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{formatCurrencyUsd(item.amount)}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{item.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Recent audit log</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">What changed in the pipeline</h2>
            </div>
            <Badge variant="outline" className="border-emerald-400/15 bg-emerald-400/8 text-emerald-200">
              {model.raw.generated}
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            {model.auditLog.map((event) => (
              <div key={event.id} className="flex gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="mt-1 rounded-full border border-emerald-400/15 bg-emerald-400/8 p-2 text-emerald-300">
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

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">System posture</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Console quality signals</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-emerald-300" />
                <p className="font-medium text-white">Vendor registry is explicit</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Every supplier is surfaced with recurring state, source, owner, and parsing confidence.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <CircleAlert className="size-4 text-amber-300" />
                <p className="font-medium text-white">Manual flows are isolated</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Manual and one-off charges are now visibly separate from importer-backed recurring spend.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="size-4 text-sky-300" />
                <p className="font-medium text-white">Ready for live automation next</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                The shell, routes, and settings surface are prepared for future Gmail push, AI parsing, and vendor APIs.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
