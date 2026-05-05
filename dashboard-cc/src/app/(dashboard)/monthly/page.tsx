"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ManualIncome, ManualExpenseOther } from "@/lib/types";
import { formatILS, lastNMonths, monthKey } from "@/lib/format";
import { fetchToolsSnapshot } from "@/lib/tools-mirror";

const MONTHS = lastNMonths(6);

export default function MonthlyPage() {
  const [income, setIncome] = useState<ManualIncome[]>([]);
  const [expenses, setExpenses] = useState<ManualExpenseOther[]>([]);
  const [toolsIls, setToolsIls] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      Promise.all([
        sb.from("manual_income").select("*").eq("owner_id", user.id),
        sb.from("manual_expense_other").select("*").eq("owner_id", user.id),
        fetchToolsSnapshot(),
      ]).then(([{ data: inc }, { data: exp }, tools]) => {
        setIncome((inc ?? []) as ManualIncome[]);
        setExpenses((exp ?? []) as ManualExpenseOther[]);
        if (tools) setToolsIls(tools.totals.total_ils);
        setLoading(false);
      });
    });
  }, []);

  function incomeForMonth(m: string) {
    return income
      .filter((r) => r.paid_at.startsWith(m))
      .reduce((s, r) => s + (r.currency === "ILS" ? r.amount : r.amount * 3.7), 0);
  }

  function otherExpenseForMonth(m: string) {
    return expenses
      .filter((r) => r.expense_date.startsWith(m))
      .reduce((s, r) => s + (r.currency === "ILS" ? r.amount : r.amount * 3.7), 0);
  }

  // Tools expenses spread evenly across tracked months (approximate)
  const toolsPerMonth = MONTHS.length > 0 ? toolsIls / MONTHS.length : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">דוח חודשי</h1>
      {loading ? (
        <div className="text-gray-400 text-sm">טוען...</div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="px-4 py-3 text-right font-medium">חודש</th>
                <th className="px-4 py-3 text-center font-medium text-green-700">הכנסות</th>
                <th className="px-4 py-3 text-center font-medium text-red-600">כלים</th>
                <th className="px-4 py-3 text-center font-medium text-red-600">הוצאות אחר</th>
                <th className="px-4 py-3 text-center font-medium">רווח נקי</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m) => {
                const inc = incomeForMonth(m);
                const tools = toolsPerMonth;
                const other = otherExpenseForMonth(m);
                const profit = inc - tools - other;
                return (
                  <tr key={m} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{m.slice(5)}/{m.slice(2, 4)}</td>
                    <td className="px-4 py-3 text-center text-green-700">{formatILS(inc)}</td>
                    <td className="px-4 py-3 text-center text-red-500">{formatILS(tools)}</td>
                    <td className="px-4 py-3 text-center text-red-500">{formatILS(other)}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${profit >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {formatILS(profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-gray-400 bg-gray-50">
            * עלויות כלים מפוזרות שווה בשווה על {MONTHS.length} חודשים (הערכה)
          </div>
        </div>
      )}
    </div>
  );
}
