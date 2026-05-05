"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ManualIncome } from "@/lib/types";
import { formatILS, formatUSD, lastNMonths, monthKey } from "@/lib/format";

const MONTHS = lastNMonths(6);

export default function IncomePage() {
  const [rows, setRows] = useState<ManualIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"ILS" | "USD">("ILS");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from("manual_income").select("*").eq("owner_id", user.id).order("paid_at", { ascending: false });
    setRows((data ?? []) as ManualIncome[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!customer.trim() || !amount) return;
    setSaving(true);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("manual_income").insert({
      owner_id: user.id,
      customer_name: customer.trim(),
      amount: Number(amount),
      currency,
      paid_at: paidAt,
      description: description.trim() || null,
    });
    setCustomer(""); setAmount(""); setDescription("");
    setSaving(false);
    load();
  }

  // Build grid: customers × months
  const customers = [...new Set(rows.map((r) => r.customer_name))].sort();
  function cellValue(cust: string, month: string) {
    return rows.filter((r) => r.customer_name === cust && r.paid_at.startsWith(month));
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">הכנסות</h1>

      <form onSubmit={addIncome} className="bg-white rounded-xl shadow p-4 mb-6 grid grid-cols-2 gap-3">
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="שם לקוח"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="סכום"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "ILS" | "USD")}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
          >
            <option value="ILS">₪</option>
            <option value="USD">$</option>
          </select>
        </div>
        <input
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="תיאור (אופציונלי)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "שומר..." : "+ הוסף הכנסה"}
        </button>
      </form>

      {loading ? (
        <div className="text-gray-400 text-sm">טוען...</div>
      ) : customers.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-12">אין הכנסות עדיין</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="px-4 py-3 text-right font-medium">לקוח</th>
                {MONTHS.map((m) => <th key={m} className="px-4 py-3 text-center font-medium">{m.slice(5)}/{m.slice(2, 4)}</th>)}
                <th className="px-4 py-3 text-center font-medium">סה״כ</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((cust) => {
                const custRows = rows.filter((r) => r.customer_name === cust);
                const total = custRows.reduce((s, r) => s + (r.currency === "ILS" ? r.amount : r.amount * 3.7), 0);
                return (
                  <tr key={cust} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{cust}</td>
                    {MONTHS.map((m) => {
                      const cells = cellValue(cust, m);
                      return (
                        <td key={m} className="px-4 py-3 text-center text-xs">
                          {cells.map((r) => (
                            <div key={r.id}>{r.currency === "ILS" ? formatILS(r.amount) : formatUSD(r.amount)}</div>
                          ))}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-semibold text-blue-700">{formatILS(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
