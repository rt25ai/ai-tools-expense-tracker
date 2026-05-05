"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ManualExpenseOther, ToolsExpenseSnapshot } from "@/lib/types";
import { formatILS, formatUSD, formatDate } from "@/lib/format";
import { fetchToolsSnapshot } from "@/lib/tools-mirror";

type Tab = "כלים" | "אחר";

export default function ExpensesPage() {
  const [tab, setTab] = useState<Tab>("כלים");
  const [tools, setTools] = useState<ToolsExpenseSnapshot | null>(null);
  const [toolsLoading, setToolsLoading] = useState(true);
  const [other, setOther] = useState<ManualExpenseOther[]>([]);
  const [otherLoading, setOtherLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"ILS" | "USD">("ILS");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState<"מסים" | "אחר">("אחר");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchToolsSnapshot().then((d) => { setTools(d); setToolsLoading(false); });
  }, []);

  useEffect(() => {
    if (tab !== "אחר") return;
    loadOther();
  }, [tab]);

  async function loadOther() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from("manual_expense_other").select("*").eq("owner_id", user.id).order("expense_date", { ascending: false });
    setOther((data ?? []) as ManualExpenseOther[]);
    setOtherLoading(false);
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) return;
    setSaving(true);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("manual_expense_other").insert({
      owner_id: user.id,
      amount: Number(amount),
      currency,
      expense_date: expenseDate,
      category,
      vendor: vendor.trim() || null,
      description: description.trim() || null,
    });
    setAmount(""); setVendor(""); setDescription("");
    setSaving(false);
    loadOther();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">הוצאות</h1>
      <div className="flex gap-2 mb-6">
        {(["כלים", "אחר"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${tab === t ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow hover:bg-gray-50"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "כלים" && (
        toolsLoading ? (
          <div className="text-gray-400 text-sm">טוען...</div>
        ) : !tools ? (
          <div className="text-gray-400 text-sm text-center py-12">לא נמצאו נתוני כלים</div>
        ) : (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow px-5 py-4">
                <div className="text-2xl font-bold text-blue-600">{formatUSD(tools.totals.total_usd)}</div>
                <div className="text-xs text-gray-500 mt-1">סה״כ $</div>
              </div>
              <div className="bg-white rounded-xl shadow px-5 py-4">
                <div className="text-2xl font-bold text-blue-600">{formatILS(tools.totals.total_ils)}</div>
                <div className="text-xs text-gray-500 mt-1">סה״כ ₪</div>
              </div>
              <div className="bg-white rounded-xl shadow px-5 py-4">
                <div className="text-2xl font-bold text-gray-700">{tools.totals.months_tracked}</div>
                <div className="text-xs text-gray-500 mt-1">חודשים</div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="px-4 py-3 text-right font-medium">ספק</th>
                    <th className="px-4 py-3 text-center font-medium">$</th>
                    <th className="px-4 py-3 text-center font-medium">₪</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.vendors.map((v) => (
                    <tr key={v.vendor} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{v.vendor}</td>
                      <td className="px-4 py-3 text-center">{formatUSD(v.total_usd)}</td>
                      <td className="px-4 py-3 text-center">{formatILS(v.total_ils)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {tab === "אחר" && (
        <div>
          <form onSubmit={addExpense} className="bg-white rounded-xl shadow p-4 mb-6 grid grid-cols-2 gap-3">
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as "מסים" | "אחר")}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="מסים">מסים</option>
              <option value="אחר">אחר</option>
            </select>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="ספק (אופציונלי)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור (אופציונלי)"
              className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "שומר..." : "+ הוסף הוצאה"}
            </button>
          </form>

          {otherLoading ? (
            <div className="text-gray-400 text-sm">טוען...</div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="px-4 py-3 text-right font-medium">תאריך</th>
                    <th className="px-4 py-3 text-right font-medium">קטגוריה</th>
                    <th className="px-4 py-3 text-right font-medium">ספק</th>
                    <th className="px-4 py-3 text-center font-medium">סכום</th>
                  </tr>
                </thead>
                <tbody>
                  {other.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(r.expense_date)}</td>
                      <td className="px-4 py-3">{r.category}</td>
                      <td className="px-4 py-3 text-gray-500">{r.vendor ?? "-"}</td>
                      <td className="px-4 py-3 text-center font-medium">
                        {r.currency === "ILS" ? formatILS(r.amount) : formatUSD(r.amount)}
                      </td>
                    </tr>
                  ))}
                  {other.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">אין הוצאות עדיין</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
