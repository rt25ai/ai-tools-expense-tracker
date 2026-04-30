"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { fetchToolsSnapshot } from "@/lib/tools-mirror";
import type {
  Currency,
  ExpenseCategory,
  ManualExpenseOther,
  ToolsExpenseSnapshot,
} from "@/lib/types";
import { formatDate, formatILS, formatUSD } from "@/lib/format";

type Tab = "tools" | "other";

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>("tools");

  return (
    <div className="space-y-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">הוצאות</h1>
          <p className="text-sm text-zinc-500">כלים (מראה) + הוצאות אחרות (ידני)</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 text-sm dark:border-zinc-800">
          <TabBtn active={tab === "tools"} onClick={() => setTab("tools")}>
            כלים (מראה)
          </TabBtn>
          <TabBtn active={tab === "other"} onClick={() => setTab("other")}>
            אחר (ידני)
          </TabBtn>
        </div>
      </header>

      {tab === "tools" ? <ToolsMirror /> : <ManualOther />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 transition ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

function ToolsMirror() {
  const [snap, setSnap] = useState<ToolsExpenseSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchToolsSnapshot()
      .then(setSnap)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
        טעינת מראה נכשלה: {error}
      </div>
    );
  }

  if (!snap) {
    return <div className="p-6 text-sm text-zinc-500">טוען מראה הוצאות כלים…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat title="סה״כ ₪" value={formatILS(snap.grand_total_ils)} />
        <Stat title="סה״כ $" value={formatUSD(snap.grand_total)} />
        <Stat
          title="עודכן לאחרונה"
          value={snap.built_at ? formatDate(snap.built_at) : "—"}
        />
      </div>

      {snap.vendors && snap.vendors.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-3 py-2 text-start">כלי</th>
                <th className="px-3 py-2 text-end">סה״כ ₪</th>
                <th className="px-3 py-2 text-end">סה״כ $</th>
                <th className="px-3 py-2 text-end">חיוב אחרון</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {snap.vendors
                .slice()
                .sort((a, b) => b.total_ils - a.total_ils)
                .map((v) => (
                  <tr key={v.tool}>
                    <td className="px-3 py-2 font-medium">{v.tool}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatILS(v.total_ils)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatUSD(v.total_usd)}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{formatDate(v.last_charge)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        מקור: <code dir="ltr">data.json</code> מהtracker הקיים — read-only. לעריכה, השתמש בtracker המקורי.
      </p>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ManualOther() {
  const [rows, setRows] = useState<ManualExpenseOther[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("manual_expense_other")
      .select("*")
      .order("expense_date", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ManualExpenseOther[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4">
      <ManualExpenseForm onAdded={refresh} />

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">טוען…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">אין הוצאות &quot;אחר&quot; עדיין.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
              <tr>
                <th className="px-3 py-2 text-start">תאריך</th>
                <th className="px-3 py-2 text-start">קטגוריה</th>
                <th className="px-3 py-2 text-start">ספק</th>
                <th className="px-3 py-2 text-end">סכום</th>
                <th className="px-3 py-2 text-start">תיאור</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{formatDate(r.expense_date)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                      {r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.vendor || "—"}</td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {r.currency === "ILS" ? formatILS(r.amount) : formatUSD(r.amount)}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{r.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ManualExpenseForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("ILS");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<ExpenseCategory>("אחר");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("manual_expense_other").insert({
      owner_id: u.user.id,
      amount: Number(amount),
      currency,
      expense_date: date,
      category,
      vendor: vendor || null,
      description: description || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setAmount("");
    setVendor("");
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
        + הוסף הוצאה ידנית
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="מסים">מסים</option>
          <option value="אחר">אחר</option>
        </select>
        <input
          placeholder="ספק (אופציונלי)"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="תיאור (אופציונלי)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
