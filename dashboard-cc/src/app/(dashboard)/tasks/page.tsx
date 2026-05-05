"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Task } from "@/lib/types";

type Filter = "open" | "done" | "all";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<"simple" | "counter">("simple");
  const [targetCount, setTargetCount] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const q = sb.from("tasks").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    const { data } = await q;
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("tasks").insert({
      owner_id: user.id,
      title: title.trim(),
      type: taskType,
      target_count: taskType === "counter" ? Number(targetCount) || null : null,
    });
    setTitle("");
    setTargetCount("");
    setSaving(false);
    load();
  }

  async function markDone(task: Task) {
    const sb = getSupabase();
    if (task.type === "counter" && task.target_count !== null) {
      const newCount = task.done_count + 1;
      const isDone = newCount >= task.target_count;
      await sb.from("tasks").update({
        done_count: newCount,
        status: isDone ? "done" : "open",
        completed_at: isDone ? new Date().toISOString() : null,
      }).eq("id", task.id);
    } else {
      await sb.from("tasks").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", task.id);
    }
    load();
  }

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : filter === "open" ? t.status === "open" : t.status === "done"
  );

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">משימות</h1>
      <form onSubmit={addTask} className="bg-white rounded-xl shadow p-4 mb-6 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת המשימה"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as "simple" | "counter")}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
          >
            <option value="simple">פשוטה</option>
            <option value="counter">ספירה</option>
          </select>
        </div>
        {taskType === "counter" && (
          <input
            type="number"
            value={targetCount}
            onChange={(e) => setTargetCount(e.target.value)}
            placeholder="מטרה (מספר)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "שומר..." : "+ הוסף משימה"}
        </button>
      </form>

      <div className="flex gap-2 mb-4">
        {(["open", "done", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 shadow hover:bg-gray-50"}`}
          >
            {f === "open" ? "פתוחות" : f === "done" ? "הושלמו" : "הכל"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">טוען...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((task) => (
            <div key={task.id} className="bg-white rounded-lg shadow px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : ""}`}>
                  {task.title}
                </div>
                {task.type === "counter" && (
                  <div className="text-xs text-gray-500 mt-0.5">{task.done_count}/{task.target_count ?? "?"}</div>
                )}
              </div>
              {task.status === "open" && (
                <button
                  onClick={() => markDone(task)}
                  className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {task.type === "counter" ? "סמן 1 ✓" : "הושלם ✓"}
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="text-gray-400 text-sm text-center py-8">אין משימות</div>}
        </div>
      )}
    </div>
  );
}
