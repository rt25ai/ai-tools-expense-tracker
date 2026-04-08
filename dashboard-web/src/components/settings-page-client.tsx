"use client";

import { startTransition, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsModel } from "@/lib/dashboard-data";

type SectionKey = keyof SettingsModel;

function SettingsRow({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 border-t border-white/6 py-5 first:border-t-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      <div>
        <p className="text-base font-medium text-zinc-100">{label}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{help}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SettingsPageClient({ initialSettings }: { initialSettings: SettingsModel }) {
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return initialSettings;

    const raw = window.localStorage.getItem("rt-ai-console-settings");
    if (!raw) return initialSettings;

    try {
      return JSON.parse(raw) as SettingsModel;
    } catch {
      window.localStorage.removeItem("rt-ai-console-settings");
      return initialSettings;
    }
  });
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);

  function saveSection(section: SectionKey) {
    startTransition(() => {
      window.localStorage.setItem("rt-ai-console-settings", JSON.stringify(settings));
      setSavedSection(section);
      window.setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 2200);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">General settings</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            These are operator-facing controls that shape how the console reads spend, creates recurring
            entries, and frames review work.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="USD exchange rate"
            help="Used for the workbook, budget framing, and the finance summary shown throughout the console."
          >
            <Input
              value={String(settings.finance.usdRate)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, usdRate: Number(event.target.value) || 0 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="Default billing day"
            help="The fallback day used when a recurring rule does not yet have a vendor-specific billing date."
          >
            <Input
              value={String(settings.finance.defaultBillingDay)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, defaultBillingDay: Number(event.target.value) || 1 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="Monthly working budget"
            help="Used for the budget vs actual panel and for highlighting months that need an operator review."
          >
            <Input
              value={String(settings.finance.monthlyBudget)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, monthlyBudget: Number(event.target.value) || 0 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">
            Exchange assumptions and billing defaults for the whole dashboard.
          </p>
          <Button onClick={() => saveSection("finance")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "finance" ? <CheckCircle2 className="mr-2 size-4" /> : null}
            Save finance settings
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">Detection rules</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Tune how the inbox parser behaves before we add richer automation and AI-assisted extraction.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="Scan window"
            help="How many days back the Gmail scanner should inspect when looking for missing invoices."
          >
            <Input
              value={String(settings.detection.scanWindowDays)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  detection: { ...settings.detection, scanWindowDays: Number(event.target.value) || 30 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="Parser mode"
            help="Controls whether the importer is optimized for precision, balanced matching, or more aggressive capture."
          >
            <Select
              value={settings.detection.parserMode}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  detection: { ...settings.detection, parserMode: value },
                })
              }
            >
              <SelectTrigger className="h-11 border-white/10 bg-black/20 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">Strict</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            label="Ignored senders"
            help="One sender pattern per line. Use this for noise that should never open a review item."
          >
            <Textarea
              value={settings.detection.ignoredSenders.join("\n")}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  detection: {
                    ...settings.detection,
                    ignoredSenders: event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="min-h-32 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">Current detection assumptions for Gmail, PDF text, and body parsing.</p>
          <Button onClick={() => saveSection("detection")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "detection" ? <CheckCircle2 className="mr-2 size-4" /> : null}
            Save detection rules
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">Vendor registry</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Maintain the list of known vendors and the subset that still rely on manual confirmation.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="Known vendors"
            help="This list powers the vendor console and acts as the review baseline for new incoming charges."
          >
            <Textarea
              value={settings.vendors.knownVendors.join("\n")}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  vendors: {
                    ...settings.vendors,
                    knownVendors: event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="min-h-40 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="Manual-only vendors"
            help="Use this to mark suppliers that should stay in the review flow until we wire a deterministic importer."
          >
            <Textarea
              value={settings.vendors.manualOnlyVendors.join("\n")}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  vendors: {
                    ...settings.vendors,
                    manualOnlyVendors: event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="min-h-32 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">This section frames what the system should treat as normal vendor behavior.</p>
          <Button onClick={() => saveSection("vendors")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "vendors" ? <CheckCircle2 className="mr-2 size-4" /> : null}
            Save vendor registry
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">Recurring rules</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            These controls shape the recurring layer that fills expected monthly charges before the inbox catches them.
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          {[
            {
              checked: settings.recurringRules.openAiEnabled,
              title: "Inject OpenAI recurring charge on the 16th",
              description: "Keeps ChatGPT Plus visible in every month even before the invoice import lands.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, openAiEnabled: checked },
                }),
            },
            {
              checked: settings.recurringRules.rebuildDashboardOnChange,
              title: "Rebuild dashboard when the report changes",
              description: "Keeps the static console and the Excel workbook derived from the same source of truth.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, rebuildDashboardOnChange: checked },
                }),
            },
            {
              checked: settings.recurringRules.autopublishEnabled,
              title: "Mark dashboard publish as part of the workflow",
              description: "Keeps the GitHub Pages export visible as a first-class step in the operator console.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, autopublishEnabled: checked },
                }),
            },
          ].map((item) => (
            <label key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
              <Checkbox checked={item.checked} onCheckedChange={(checked) => item.update(checked === true)} />
              <div>
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">Recurring rules are what make this feel like an operations system, not just a report.</p>
          <Button onClick={() => saveSection("recurringRules")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "recurringRules" ? <CheckCircle2 className="mr-2 size-4" /> : null}
            Save recurring rules
          </Button>
        </div>
      </Card>
    </div>
  );
}
