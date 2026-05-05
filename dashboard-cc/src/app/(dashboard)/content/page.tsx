"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ContentLog } from "@/lib/types";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "blog", label: "Blog" },
] as const;

export default function ContentPage() {
  const [logs, setLogs] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<"whatsapp" | "instagram" | "blog">("instagram");
  const [titleOrExcerpt, setTitleOrExcerpt] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await sb.from("content_log").select("*").eq("owner_id", user.id).gte("posted_at", since).order("posted_at", { ascending: false });
    setLogs((data ?? []) as ContentLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("content_log").insert({
      owner_id: user.id,
      channel,
      title_or_excerpt: titleOrExcerpt.trim() || null,
      url: url.trim() || null,
      notes: notes.trim() || null,
    });
    setTitleOrExcerpt(""); setUrl(""); setNotes("");
    setSaving(false);
    load();
  }

  function streak(ch: string) {
    const sorted = logs.filter((l) => l.channel === ch).map((l) => l.posted_at.split("T")[0]).sort().reverse();
    if (!sorted.length) return 0;
    let count = 0;
    let check = new Date().toISOString().split("T")[0];
    for (const d of sorted) {
      if (d === check) {
        count++;
        const dt = new Date(check);
        dt.setDate(dt.getDate() - 1);
        check = dt.toISOString().split("T")[0];
      } else if (d < check) break;
    }
    return count;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">תוכן</h1>

      <div className="flex gap-4 mb-8">
        {CHANNELS.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-xl shadow px-6 py-4 text-center flex-1">
            <div className="text-3xl font-bold text-blue-600">{streak(key)}</div>
            <div className="text-sm font-medium mt-1">{label}</div>
            <div className="text-xs text-gray-400">ימי סטריק</div>
          </div>
        ))}
      </div>

      <form onSubmit={addLog} className="bg-white rounded-xl shadow p-4 mb-6 flex flex-col gap-3">
        <h2 className="font-semibold text-gray-700">לוג פוסט חדש</h2>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {CHANNELS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
        <input
          value={titleOrExcerpt}
          onChange={(e) => setTitleOrExcerpt(e.target.value)}
          placeholder="כותרת / תחילת הפוסט (אופציונלי)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="קישור (אופציונלי)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "שומר..." : "+ הוסף לוג"}
        </button>
      </form>

      {loading ? (
        <div className="text-gray-400 text-sm">טוען...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-lg shadow px-4 py-3">
              <div className="flex justify-between items-start">
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {CHANNELS.find((c) => c.key === log.channel)?.label}
                </span>
                <span className="text-xs text-gray-400">{new Date(log.posted_at).toLocaleDateString("he-IL")}</span>
              </div>
              {log.title_or_excerpt && <p className="text-sm text-gray-700 mt-2">{log.title_or_excerpt}</p>}
              {log.url && <a href={log.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block truncate">{log.url}</a>}
            </div>
          ))}
          {logs.length === 0 && <div className="text-gray-400 text-sm text-center py-8">אין פוסטים ב-30 ימים האחרונים</div>}
        </div>
      )}
    </div>
  );
}
