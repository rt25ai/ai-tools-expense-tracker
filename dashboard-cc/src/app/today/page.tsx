"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { formatILS } from "@/lib/format";

interface Counts {
  openTasks: number;
  todayContent: { whatsapp: number; instagram: number; blog: number };
  monthIncome: number;
  monthExpensesOther: number;
  upcomingMeetings: number;
}

const ZERO_COUNTS: Counts = {
  openTasks: 0,
  todayContent: { whatsapp: 0, instagram: 0, blog: 0 },
  monthIncome: 0,
  monthExpensesOther: 0,
  upcomingMeetings: 0,
};

export default function TodayPage() {
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase
        .from("content_log")
        .select("channel")
        .gte("posted_at", startOfDay.toISOString()),
      supabase
        .from("manual_income")
        .select("amount,currency")
        .gte("paid_at", startOfMonth.toISOString().slice(0, 10)),
      supabase
        .from("manual_expense_other")
        .select("amount,currency")
        .gte("expense_date", startOfMonth.toISOString().slice(0, 10)),
      supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .gte("meeting_date", new Date().toISOString().slice(0, 10)),
    ]).then(([tasks, contentRes, incomeRes, expensesRes, meetingsRes]) => {
      if (cancelled) return;
      const todayContent = { whatsapp: 0, instagram: 0, blog: 0 };
      (contentRes.data ?? []).forEach((row: { channel: string }) => {
        if (row.channel in todayContent) {
          todayContent[row.channel as keyof typeof todayContent] += 1;
        }
      });
      const sumILS = (rows: Array<{ amount: number; currency: string }> | null) =>
        (rows ?? [])
          .filter((r) => r.currency === "ILS")
          .reduce((acc, r) => acc + Number(r.amount), 0);

      setCounts({
        openTasks: tasks.count ?? 0,
        todayContent,
        monthIncome: sumILS(incomeRes.data),
        monthExpensesOther: sumILS(expensesRes.data),
        upcomingMeetings: meetingsRes.count ?? 0,
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">היום</h1>
        <p className="text-sm text-zinc-500">מבט מהיר על מה קורה</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          title="משימות פתוחות"
          value={loading ? "—" : counts.openTasks.toString()}
          href="/tasks"
        />
        <Stat
          title="הכנסות החודש"
          value={loading ? "—" : formatILS(counts.monthIncome)}
          href="/income"
        />
        <Stat
          title="הוצאות אחרות החודש"
          value={loading ? "—" : formatILS(counts.monthExpensesOther)}
          href="/expenses"
        />
        <Stat
          title="פגישות קרובות"
          value={loading ? "—" : counts.upcomingMeetings.toString()}
          href="/meetings"
        />
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold">תוכן יומי</h2>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <ChannelChip
            label="WhatsApp"
            count={counts.todayContent.whatsapp}
            done={counts.todayContent.whatsapp > 0}
          />
          <ChannelChip
            label="Instagram"
            count={counts.todayContent.instagram}
            done={counts.todayContent.instagram > 0}
          />
          <ChannelChip
            label="Blog"
            count={counts.todayContent.blog}
            done={counts.todayContent.blog > 0}
          />
        </div>
        <div className="mt-4">
          <Link
            href="/content"
            className="text-sm text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            לוג תוכן →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href?: string;
}) {
  const card = (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function ChannelChip({
  label,
  count,
  done,
}: {
  label: string;
  count: number;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
        done
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
          : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">{count > 0 ? `✓ ${count}` : "—"}</span>
    </div>
  );
}
