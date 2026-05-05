"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Meeting } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendees, setAttendees] = useState("");
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from("meetings").select("*").eq("owner_id", user.id).order("meeting_date", { ascending: false });
    setMeetings((data ?? []) as Meeting[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("meetings").insert({
      owner_id: user.id,
      title: title.trim(),
      meeting_date: meetingDate,
      attendees: attendees.trim() || null,
      summary: summary.trim() || null,
      action_items: actionItems.trim() || null,
    });
    setTitle(""); setAttendees(""); setSummary(""); setActionItems("");
    setShowForm(false);
    setSaving(false);
    load();
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">פגישות</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "ביטול" : "+ פגישה חדשה"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addMeeting} className="bg-white rounded-xl shadow p-4 mb-6 flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="נושא הפגישה"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="משתתפים"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="סיכום הפגישה"
            rows={3}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
            placeholder="משימות לביצוע"
            rows={2}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור פגישה"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">טוען...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map((m) => (
            <div key={m.id} className="bg-white rounded-xl shadow px-5 py-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{m.title}</h3>
                <span className="text-xs text-gray-400">{formatDate(m.meeting_date)}</span>
              </div>
              {m.attendees && <p className="text-xs text-gray-500 mb-2">👥 {m.attendees}</p>}
              {m.summary && <p className="text-sm text-gray-700 mb-2">{m.summary}</p>}
              {m.action_items && (
                <div className="text-xs text-orange-700 bg-orange-50 px-3 py-2 rounded">
                  <strong>משימות:</strong> {m.action_items}
                </div>
              )}
            </div>
          ))}
          {meetings.length === 0 && <div className="text-gray-400 text-sm text-center py-8">אין פגישות עדיין</div>}
        </div>
      )}
    </div>
  );
}
