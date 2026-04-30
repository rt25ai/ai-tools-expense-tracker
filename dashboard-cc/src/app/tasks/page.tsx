"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Task, TaskType } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");

  async function refresh() {
    const supabase = getSupabase();
    let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [filter]);

  async function onCreate(input: NewTaskInput) {
    const supabase = getSupabase();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("tasks").insert({
      owner_id: u.user.id,
      title: input.title,
      type: input.type,
      target_count: input.target_count,
      channel: input.channel || null,
      due_date: input.due_date || null,
      notes: input.notes || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    refresh();
  }

  async function incrementCounter(t: Task) {
    if (t.type !== "counter") return;
    const supabase = getSupabase();
    const next = t.done_count + 1;
    const target = t.target_count ?? 0;
    const updates: Partial<Task> = { done_count: next };
    if (target > 0 && next >= target) {
      updates.status = "done";
      updates.completed_at = new Date().toISOString();
    }
    await supabase.from("tasks").update(updates).eq("id", t.id);
    refresh();
  }

  async function toggleDone(t: Task) {
    const supabase = getSupabase();
    const isDone = t.status === "done";
    await supabase
      .from("tasks")
      .update({
        status: isDone ? "open" : "done",
        completed_at: isDone ? null : new Date().toISOString(),
      })
      .eq("id", t.id);
    refresh();
  }

  return (
    <div className="space-y-6 p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">משימות</h1>
          <p className="text-sm text-zinc-500">כולל מצב סופר &quot;4 סרטוני אניפט&quot;</p>
        </div>
        <FilterTabs value={filter} onChange={setFilter} />
      </header>

      <NewTaskForm onSubmit={onCreate} />

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="p-6 text-sm text-zinc-500">טוען…</div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">אין משימות.</div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-4 p-4">
                <button
                  type="button"
                  onClick={() => toggleDone(t)}
                  className={`h-5 w-5 shrink-0 rounded border ${
                    t.status === "done"
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  aria-label={t.status === "done" ? "החזר לפתוח" : "סמן כבוצע"}
                >
                  {t.status === "done" ? "✓" : ""}
                </button>
                <div className="flex-1">
                  <div className={`font-medium ${t.status === "done" ? "text-zinc-400 line-through" : ""}`}>
                    {t.title}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                    {t.type === "counter" && t.target_count != null && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        {t.done_count} / {t.target_count}
                      </span>
                    )}
                    {t.channel && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        {t.channel}
                      </span>
                    )}
                    {t.due_date && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        עד {formatDate(t.due_date)}
                      </span>
                    )}
                  </div>
                </div>
                {t.type === "counter" && t.status === "open" && (
                  <button
                    type="button"
                    onClick={() => incrementCounter(t)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    סמן 1 הושלם
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterTabs({
  value,
  onChange,
}: {
  value: "open" | "done" | "all";
  onChange: (v: "open" | "done" | "all") => void;
}) {
  const tabs: Array<{ key: typeof value; label: string }> = [
    { key: "open", label: "פתוחות" },
    { key: "done", label: "בוצעו" },
    { key: "all", label: "הכל" },
  ];
  return (
    <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 text-sm dark:border-zinc-800">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`rounded-md px-3 py-1 transition ${
            value === t.key
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface NewTaskInput {
  title: string;
  type: TaskType;
  target_count: number | null;
  channel: string;
  due_date: string;
  notes: string;
}

function NewTaskForm({ onSubmit }: { onSubmit: (input: NewTaskInput) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("simple");
  const [target, setTarget] = useState("");
  const [channel, setChannel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  function handle(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      title,
      type,
      target_count: type === "counter" ? Number(target) || null : null,
      channel,
      due_date: dueDate,
      notes,
    });
    setTitle("");
    setTarget("");
    setChannel("");
    setDueDate("");
    setNotes("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        + משימה חדשה
      </button>
    );
  }

  return (
    <form onSubmit={handle} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          required
          placeholder="כותרת"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          <option value="simple">פשוטה</option>
          <option value="counter">סופר (multi-step)</option>
          <option value="content_daily">תוכן יומי</option>
        </select>
        {type === "counter" && (
          <input
            required
            type="number"
            min={1}
            placeholder="יעד (כמה פעמים)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        )}
        <input
          placeholder="ערוץ (whatsapp / instagram / video / וכו')"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>
      <textarea
        placeholder="הערות"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
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
