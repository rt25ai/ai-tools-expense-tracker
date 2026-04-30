"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Meeting } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function MeetingsPage() {
  const [rows, setRows] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Meeting[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">פגישות</h1>
        <p className="text-sm text-zinc-500">סיכומים וסעיפי פעולה</p>
      </header>

      <NewMeetingForm onAdded={refresh} />

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            טוען…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            אין פגישות עדיין.
          </div>
        ) : (
          rows.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <header className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{m.title}</h2>
                <span className="text-sm text-zinc-500">{formatDate(m.meeting_date)}</span>
              </header>
              {m.attendees && (
                <p className="mt-1 text-sm text-zinc-500">משתתפים: {m.attendees}</p>
              )}
              {m.summary && (
                <p className="mt-3 whitespace-pre-wrap text-sm">{m.summary}</p>
              )}
              {m.action_items && (
                <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    סעיפי פעולה
                  </div>
                  <p className="whitespace-pre-wrap">{m.action_items}</p>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function NewMeetingForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendees, setAttendees] = useState("");
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("meetings").insert({
      owner_id: u.user.id,
      title,
      meeting_date: date,
      attendees: attendees || null,
      summary: summary || null,
      action_items: actions || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setTitle("");
    setAttendees("");
    setSummary("");
    setActions("");
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
        + פגישה חדשה
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          required
          placeholder="כותרת"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          placeholder="משתתפים"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          className="md:col-span-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <textarea
        placeholder="סיכום"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={4}
        className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
      <textarea
        placeholder="סעיפי פעולה"
        value={actions}
        onChange={(e) => setActions(e.target.value)}
        rows={3}
        className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
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
