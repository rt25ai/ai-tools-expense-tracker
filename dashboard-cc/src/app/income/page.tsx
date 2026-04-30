"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ManualIncome, Currency } from "@/lib/types";
import { formatILS, lastNMonths, monthKey } from "@/lib/format";

export default function IncomePage() {
  const [rows, setRows] = useState<ManualIncome[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("manual_income")
      .select("*")
      .order("paid_at", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ManualIncome[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const months = useMemo(() => lastNMonths(12), []);

  const grid = useMemo(() => {
    const customers = Array.from(new Set(rows.map((r) => r.customer_name))).sort();
    const cell = (customer: string, m: string) =>
      rows
        .filter(
          (r) =>
            r.customer_name === customer &&
            monthKey(r.paid_at) === m &&
            r.currency === "ILS",
        )
        .reduce((acc, r) => acc + Number(r.amount), 0);
    const totals: Record<string, number> = {};
    months.forEach((m) => {
      totals[m] = customers.reduce((acc, c) => acc + cell(c, m), 0);
    });
    return { customers, cell, totals };
  }, [rows, months]);

  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">הכנסות</h1>
        <p className="text-sm text-zinc-500">לקוח × חודש (12 החודשים האחרונים)</p>
      </header>

      <ManualIncomeForm onAdded={refresh} />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">טוען…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-3 py-2 text-start">לקוח</th>
                {months.map((m) => (
                  <th key={m} className="px-3 py-2 text-end">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr className="bg-zinc-50 font-semibold dark:bg-zinc-950">
                <td className="px-3 py-2">סה&quot;כ</td>
                {months.map((m) => (
                  <td key={m} className="px-3 py-2 text-end tabular-nums">
                    {grid.totals[m] ? formatILS(grid.totals[m]) : "—"}
                  </td>
                ))}
              </tr>
              {grid.customers.map((c) => (
                <tr key={c}>
                  <td className="px-3 py-2 font-medium">{c}</td>
                  {months.map((m) => {
                    const v = grid.cell(c, m);
                    return (
                      <td key={m} className="px-3 py-2 text-end tabular-nums">
                        {v ? formatILS(v) : <span className="text-zinc-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {grid.customers.length === 0 && (
                <tr>
                  <td colSpan={months.length + 1} className="px-3 py-6 text-center text-zinc-500">
                    אין הכנסות עדיין. הוסף הכנסה ידנית.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ManualIncomeForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("manual_income").insert({
      owner_id: u.user.id,
      customer_name: customer,
      amount: Number(amount),
      currency,
      paid_at: paidAt,
      description: description || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setCustomer("");
    setAmount("");
    setDescription("");
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        + הוסף הכנסה ידנית
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          required
          placeholder="לקוח"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          required
          type="number"
          step="0.01"
          min="0"
          placeholder="סכום"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="ILS">₪ ILS</option>
          <option value="USD">$ USD</option>
        </select>
        <input
          required
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="תיאור (אופציונלי)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="md:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          שמור
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
