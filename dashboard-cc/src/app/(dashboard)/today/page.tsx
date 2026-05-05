"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Task, ContentLog } from "@/lib/types";

const CHANNELS = ["whatsapp", "instagram", "blog"] as const;
const LABELS: Record<string, string> = { whatsapp: "WhatsApp", instagram: "Instagram", blog: "Blog" };

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    Promise.all([
      sb.from("tasks").select("*").eq("status", "open"),
      sb.from("content_log").select("*").gte("posted_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]).then(([{ data: t }, { data: l }]) => {
      setTasks((t ?? []) as Task[]);
      setLogs((l ?? []) as ContentLog[]);
      setLoading(false);
    });
  }, []);

  function streak(channel: string) {
    const sorted = logs
      .filter((l) => l.channel === channel)
      .map((l) => l.posted_at.split("T")[0])
      .sort()
      .reverse();
    if (!sorted.length) return 0;
    let count = 0;
    const today = new Date().toISOString().split("T")[0];
    let check = today;
    for (const d of sorted) {
      if (d === check) { count++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split("T")[0]; }
      else if (d < check) break;
    }
    return count;
  }

  const counterTasks = tasks.filter((t) => t.type === "counter");
  const openSimple = tasks.filter((t) => t.type === "simple").length;

  if (loading) return <div className="text-gray-400 text-sm">טוען...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">היום</h1>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card label="משימות פתוחות" value={String(openSimple)} />
        <Card label="פרויקטים פעילים" value={String(counterTasks.length)} />
      </div>
      <h2 className="font-semibold text-gray-700 mb-3">סטריק תוכן</h2>
      <div className="flex gap-4 flex-wrap">
        {CHANNELS.map((ch) => (
          <div key={ch} className="bg-white rounded-xl shadow px-5 py-4 text-center min-w-[100px]">
            <div className="text-2xl font-bold text-blue-600">{streak(ch)}</div>
            <div className="text-xs text-gray-500 mt-1">{LABELS[ch]}</div>
            <div className="text-xs text-gray-400">ימים</div>
          </div>
        ))}
      </div>
      {counterTasks.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-gray-700 mb-3">פרויקטים</h2>
          <div className="flex flex-col gap-2">
            {counterTasks.map((t) => (
              <div key={t.id} className="bg-white rounded-lg shadow px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">{t.title}</span>
                <span className="text-sm text-gray-500">{t.done_count}/{t.target_count ?? "?"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow px-5 py-4">
      <div className="text-3xl font-bold text-blue-600">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
