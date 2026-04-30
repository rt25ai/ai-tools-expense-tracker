"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { fetchToolsSnapshot } from "@/lib/tools-mirror";
import { formatILS, lastNMonths } from "@/lib/format";

interface MonthSums {
  income: number;
  toolsExpenses: number;
  otherExpenses: number;
}

export default function MonthlyPage() {
  const months = useMemo(() => lastNMonths(12), []);
  const [selected, setSelected] = useState(months[months.length - 1]);
  const [sums, setSums] = useState<Record<string, MonthSums>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getSupabase();
      const start = `${months[0]}-01`;
      const [incomeRes, expRes, toolsSnap] = await Promise.all([
        supabase
          .from("manual_income")
          .select("amount,currency,paid_at")
          .gte("paid_at", start),
        supabase
          .from("manual_expense_other")
          .select("amount,currency,expense_date")
          .gte("expense_date", start),
        fetchToolsSnapshot().catch(() => null),
      ]);
      if (cancelled) return;
      const map: Record<string, MonthSums> = {};
      months.forEach((m) => (map[m] = { income: 0, toolsExpenses: 0, otherExpenses: 0 }));

      (incomeRes.data ?? []).forEach((r: { amount: number; currency: string; paid_at: string }) => {
        if (r.currency !== "ILS") return;
        const m = r.paid_at.slice(0, 7);
        if (map[m]) map[m].income += Number(r.amount);
      });
      (expRes.data ?? []).forEach((r: { amount: number; currency: string; expense_date: string }) => {
        if (r.currency !== "ILS") return;
        const m = r.expense_date.slice(0, 7);
        if (map[m]) map[m].otherExpenses += Number(r.amount);
      });
      if (toolsSnap?.monthly) {
        toolsSnap.monthly.forEach((row) => {
          if (map[row.month]) map[row.month].toolsExpenses = row.total_ils ?? 0;
        });
      }
      setSums(map);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [months]);

  const m = sums[selected] ?? { income: 0, toolsExpenses: 0, otherExpenses: 0 };
  const totalExpenses = m.toolsExpenses + m.otherExpenses;
  const profit = m.income - totalExpenses;

  return (
    <div className="space-y-6 p-8">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">דוח חודשי</h1>
          <p className="text-sm text-zinc-500">שורה תחתונה</p>
        </div>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {months
            .slice()
            .reverse()
            .map((mo) => (
              <option key={mo} value={mo}>
                {mo}
              </option>
            ))}
        </select>
      </header>

      {loading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          טוען…
        </div>
      ) : (
        <>
          <div className={`rounded-xl border p-8 ${profit >= 0 ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              רווח / הפסד
            </div>
            <div className={`mt-2 text-4xl font-semibold tabular-nums ${profit >= 0 ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"}`}>
              {formatILS(profit)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="הכנסות" value={formatILS(m.income)} tone="positive" />
            <Card title="הוצאות כלים" value={formatILS(m.toolsExpenses)} tone="negative" />
            <Card title="הוצאות אחרות" value={formatILS(m.otherExpenses)} tone="negative" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                <tr>
                  <th className="px-3 py-2 text-start">חודש</th>
                  <th className="px-3 py-2 text-end">הכנסות</th>
                  <th className="px-3 py-2 text-end">כלים</th>
                  <th className="px-3 py-2 text-end">אחר</th>
                  <th className="px-3 py-2 text-end">רווח / הפסד</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {months
                  .slice()
                  .reverse()
                  .map((mo) => {
                    const ms = sums[mo] ?? { income: 0, toolsExpenses: 0, otherExpenses: 0 };
                    const p = ms.income - (ms.toolsExpenses + ms.otherExpenses);
                    return (
                      <tr key={mo}>
                        <td className="px-3 py-2 font-medium">{mo}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{formatILS(ms.income)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{formatILS(ms.toolsExpenses)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{formatILS(ms.otherExpenses)}</td>
                        <td className={`px-3 py-2 text-end tabular-nums ${p >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                          {formatILS(p)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "positive" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
        {value}
      </div>
    </div>
  );
}
