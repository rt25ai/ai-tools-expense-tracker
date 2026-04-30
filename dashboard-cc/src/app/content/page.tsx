"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { ContentChannel, ContentLog } from "@/lib/types";
import { formatDate } from "@/lib/format";

const CHANNELS: ContentChannel[] = ["whatsapp", "instagram", "blog"];

export default function ContentPage() {
  const [rows, setRows] = useState<ContentLog[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = getSupabase();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data, error } = await supabase
      .from("content_log")
      .select("*")
      .gte("posted_at", since.toISOString())
      .order("posted_at", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ContentLog[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const streaks = useMemo(() => {
    const byChannel: Record<ContentChannel, Set<string>> = {
      whatsapp: new Set(),
      instagram: new Set(),
      blog: new Set(),
    };
    for (const r of rows) {
      const day = r.posted_at.slice(0, 10);
      byChannel[r.channel].add(day);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    function compute(set: Set<string>) {
      let n = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (set.has(key)) n++;
        else break;
      }
      return n;
    }
    return {
      whatsapp: compute(byChannel.whatsapp),
      instagram: compute(byChannel.instagram),
      blog: compute(byChannel.blog),
    };
  }, [rows]);

  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">תוכן</h1>
        <p className="text-sm text-zinc-500">לוג + רצפים (streaks) — 30 יום אחרונים</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CHANNELS.map((ch) => (
          <StreakCard key={ch} channel={ch} days={streaks[ch]} />
        ))}
      </div>

      <NewPostForm onAdded={refresh} />

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">טוען…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">אין פוסטים ב-30 יום האחרונים.</div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {r.channel}
                  </span>
                  <span className="text-xs text-zinc-500">{formatDate(r.posted_at)}</span>
                </div>
                {r.title_or_excerpt && (
                  <div className="mt-1 text-sm">{r.title_or_excerpt}</div>
                )}
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="mt-1 inline-block text-xs text-zinc-500 underline"
                  >
                    {r.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StreakCard({ channel, days }: { channel: ContentChannel; days: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{channel}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{days}</span>
        <span className="text-sm text-zinc-500">ימים ברצף</span>
      </div>
    </div>
  );
}

function NewPostForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ContentChannel>("instagram");
  const [excerpt, setExcerpt] = useState("");
  const [url, setUrl] = useState("");
  const [contentType, setContentType] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("content_log").insert({
      owner_id: u.user.id,
      channel,
      title_or_excerpt: excerpt || null,
      url: url || null,
      content_type: contentType || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setExcerpt("");
    setUrl("");
    setContentType("");
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
        + לוג פוסט חדש
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as ContentChannel)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="blog">Blog</option>
        </select>
        <input
          placeholder="סוג (Reel / Story / Post / מאמר…)"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="כותרת או תקציר"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="md:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          dir="ltr"
          placeholder="URL (אופציונלי)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
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
