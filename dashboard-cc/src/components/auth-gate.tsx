"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const PUBLIC_PATHS = new Set<string>(["/login", "/setup"]);

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<
    "checking" | "authed" | "anon" | "missing-config"
  >("checking");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus("missing-config");
      return;
    }
    const supabase = getSupabase();
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? "authed" : "anon");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "authed" : "anon");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status === "anon" && !PUBLIC_PATHS.has(pathname)) {
      router.replace("/login");
    }
  }, [status, pathname, router]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-500">
        טוען…
      </div>
    );
  }

  if (status === "missing-config") {
    return <SetupNeededScreen />;
  }

  if (status === "anon" && !PUBLIC_PATHS.has(pathname)) {
    return null;
  }

  return <>{children}</>;
}

function SetupNeededScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 text-zinc-900">
      <div className="max-w-2xl space-y-4 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">הגדרת חיבור Supabase חסרה</h1>
        <p className="text-zinc-700">
          לא הוגדרו משתני סביבה לחיבור ל-Supabase. השלב הראשון:
        </p>
        <ol className="list-decimal space-y-2 pr-6 text-zinc-700">
          <li>צור פרויקט Supabase חדש (שם מוצע: <code className="rounded bg-zinc-100 px-1">roi-personal-cc</code>)</li>
          <li>הרץ את המיגרציה <code className="rounded bg-zinc-100 px-1">cc-py/supabase/migrations/0001_phase_a.sql</code> ב-SQL Editor</li>
          <li>צור קובץ <code className="rounded bg-zinc-100 px-1">dashboard-cc/.env.local</code> ובו:</li>
        </ol>
        <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-4 text-xs text-zinc-100" dir="ltr">
{`NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...`}
        </pre>
        <p className="text-zinc-700">לאחר מכן: <code className="rounded bg-zinc-100 px-1">npm run dev</code> מחדש.</p>
      </div>
    </div>
  );
}
