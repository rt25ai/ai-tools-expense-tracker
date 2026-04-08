import { ArrowRight, BadgeCheck, Clock3, Workflow } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel } from "@/lib/dashboard-data";

export default function AutomationsPage() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="Automations"
        title="Active rules and pipeline health"
        description="This turns the dashboard into an operations console: you can see what rules exist, when they run, which parts are stable, and where the workflow still depends on a person."
        actions={<Button className="bg-emerald-500 text-black hover:bg-emerald-400">Audit pipeline</Button>}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {model.automations.map((automation) => (
          <Card key={automation.name} className="border-white/8 bg-white/[0.03] p-6 shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{automation.cadence}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{automation.name}</h2>
              </div>
              <Badge
                variant="outline"
                className={
                  automation.status === "active"
                    ? "border-emerald-400/15 bg-emerald-400/8 text-emerald-200"
                    : automation.status === "watch"
                      ? "border-amber-400/15 bg-amber-400/8 text-amber-200"
                      : "border-white/10 bg-white/[0.05] text-zinc-300"
                }
              >
                {automation.status}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">{automation.description}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Last run</p>
                <p className="mt-2 text-sm text-zinc-100">{automation.lastRun}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Next run</p>
                <p className="mt-2 text-sm text-zinc-100">{automation.nextRun}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Pipeline stages</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Current workflow map</h2>
          <div className="mt-6 space-y-4">
            {[
              "Inbox source scan",
              "Attachment and body parsing",
              "Recurring rules injection",
              "Workbook rebuild",
              "Static export to docs",
              "GitHub Pages publish",
            ].map((step, index, steps) => (
              <div key={step} className="flex items-center gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="rounded-full border border-emerald-400/15 bg-emerald-400/8 p-2 text-emerald-300">
                  <BadgeCheck className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{step}</p>
                  <p className="mt-1 text-sm text-zinc-500">Stage {index + 1}</p>
                </div>
                {index < steps.length - 1 ? <ArrowRight className="size-4 text-zinc-600" /> : null}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
            <div className="flex items-center gap-3">
              <Clock3 className="size-4 text-zinc-300" />
              <h2 className="text-xl font-semibold text-white">What this page solves</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              Instead of hiding automation inside scripts, the console now documents the rules, cadence, and operating status. That makes future upgrades much easier to reason about.
            </p>
          </Card>

          <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
            <div className="flex items-center gap-3">
              <Workflow className="size-4 text-emerald-300" />
              <h2 className="text-xl font-semibold text-white">Next automation layer</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
              <li>Gmail push instead of broad polling</li>
              <li>AI-assisted extraction for low-confidence invoices</li>
              <li>Vendor APIs for ads and subscriptions</li>
              <li>Review approvals and audit history in a real datastore</li>
            </ul>
          </Card>
        </div>
      </section>
    </>
  );
}
