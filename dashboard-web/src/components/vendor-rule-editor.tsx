"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import type { VendorRule } from "@/lib/dashboard-data";
import {
  checkGithubDirectAccess,
  getStoredToken,
  githubUpdateVendorRule,
  type GithubDirectConfig,
} from "@/lib/github-direct-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  vendorName: string;
  initialRule: VendorRule;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function getBasePath() {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/").filter(Boolean)[0] === "ai-tools-expense-tracker"
    ? "/ai-tools-expense-tracker"
    : "";
}

async function loadGithubConfig(): Promise<GithubDirectConfig | null> {
  try {
    const res = await fetch(`${getBasePath()}/manual-import-config.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload.githubOwner || !payload.githubRepo || !payload.githubBranch) return null;
    return { owner: payload.githubOwner, repo: payload.githubRepo, branch: payload.githubBranch };
  } catch {
    return null;
  }
}

export function VendorRuleEditor({ vendorName, initialRule }: Props) {
  const [open, setOpen] = useState(false);
  const [billingStatus, setBillingStatus] = useState<"active" | "stopped" | "one-time">(
    initialRule.billing_status ?? "one-time",
  );
  const [expectedAmount, setExpectedAmount] = useState(String(initialRule.expected_amount ?? ""));
  const [billingCurrency, setBillingCurrency] = useState<"USD" | "ILS">(
    initialRule.billing_currency ?? "USD",
  );
  const [billingDay, setBillingDay] = useState(String(initialRule.billing_day ?? ""));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset form when reopening
  useEffect(() => {
    if (open) {
      setBillingStatus(initialRule.billing_status ?? "one-time");
      setExpectedAmount(String(initialRule.expected_amount ?? ""));
      setBillingCurrency(initialRule.billing_currency ?? "USD");
      setBillingDay(String(initialRule.billing_day ?? ""));
      setSaveState("idle");
      setCommitHash(null);
      setErrorMsg(null);
    }
  }, [open, initialRule]);

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg(null);

    try {
      const token = getStoredToken();
      if (!token) throw new Error("לא נמצא GitHub Token. הגדר אותו בעמוד ייבוא ידני.");
      const config = await loadGithubConfig();
      if (!config) throw new Error("הגדרות GitHub לא נמצאו.");

      const access = await checkGithubDirectAccess(config, token);
      if (!access.ok) throw new Error(access.message);

      const patch: Partial<VendorRule> = {
        billing_status: billingStatus,
        subscription: billingStatus !== "one-time",
      };
      if (billingStatus === "active") {
        const amount = parseFloat(expectedAmount);
        if (!isNaN(amount) && amount > 0) patch.expected_amount = amount;
        patch.billing_currency = billingCurrency;
        const day = parseInt(billingDay);
        if (!isNaN(day) && day >= 1 && day <= 31) patch.billing_day = day;
      }

      const { commit } = await githubUpdateVendorRule(config, token, vendorName, patch);
      setCommitHash(commit);
      setSaveState("saved");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "שגיאה בשמירה.");
      setSaveState("error");
    }
  }

  function handleStop() {
    setBillingStatus("stopped");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-white/8 bg-black/20 p-1.5 text-zinc-500 transition-colors hover:border-cyan-400/20 hover:text-cyan-300"
        title="ערוך כלל חיוב"
      >
        <Pencil className="size-3.5" />
      </button>
    );
  }

  return (
    <div className="col-span-full mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-950/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-cyan-100">עריכת כלל חיוב — {vendorName}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Billing status */}
        <div className="space-y-1.5">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500">סטטוס מנוי</p>
          <select
            value={billingStatus}
            onChange={(e) => setBillingStatus(e.target.value as "active" | "stopped" | "one-time")}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-400/30 focus:outline-none"
          >
            <option value="active">מנוי פעיל</option>
            <option value="stopped">מנוי שהופסק</option>
            <option value="one-time">חד-פעמי / משתנה</option>
          </select>
        </div>

        {/* Expected amount — only when active */}
        {billingStatus === "active" && (
          <>
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">סכום צפוי</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-400/30 focus:outline-none"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">מטבע</p>
              <select
                value={billingCurrency}
                onChange={(e) => setBillingCurrency(e.target.value as "USD" | "ILS")}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-400/30 focus:outline-none"
              >
                <option value="USD">$ דולר</option>
                <option value="ILS">₪ שקל</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">יום חיוב בחודש</p>
              <input
                type="number"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-400/30 focus:outline-none"
                placeholder="1–31"
              />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saveState === "saving" || saveState === "saved"}
          className="bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-50"
          size="sm"
        >
          {saveState === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : saveState === "saved" ? (
            <Check className="size-3.5" />
          ) : null}
          {saveState === "saving" ? "שומר..." : saveState === "saved" ? "נשמר!" : "שמור שינויים"}
        </Button>

        {billingStatus !== "stopped" && (
          <Button
            onClick={handleStop}
            variant="outline"
            size="sm"
            className="border-rose-400/20 bg-rose-400/5 text-rose-300 hover:bg-rose-400/10"
          >
            בטל מנוי
          </Button>
        )}

        <Button
          onClick={() => setOpen(false)}
          variant="outline"
          size="sm"
          className="border-white/10 bg-black/20 text-zinc-300"
        >
          ביטול
        </Button>

        {saveState === "saved" && commitHash && (
          <Badge variant="outline" className="border-cyan-400/15 bg-cyan-400/8 text-cyan-200">
            commit {commitHash}
          </Badge>
        )}

        {saveState === "error" && errorMsg && (
          <p className="text-sm text-rose-300">{errorMsg}</p>
        )}
      </div>

      {saveState === "saved" && (
        <p className="mt-3 text-xs text-zinc-500">
          השינוי נשמר ב-GitHub. הדשבורד יתעדכן לאחר הבנייה הבאה (GitHub Actions).
        </p>
      )}
    </div>
  );
}
