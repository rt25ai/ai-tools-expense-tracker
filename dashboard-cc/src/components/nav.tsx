"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/today", label: "היום", icon: "🏠" },
  { href: "/tasks", label: "משימות", icon: "✅" },
  { href: "/income", label: "הכנסות", icon: "💰" },
  { href: "/expenses", label: "הוצאות", icon: "💸" },
  { href: "/content", label: "תוכן", icon: "📱" },
  { href: "/meetings", label: "פגישות", icon: "📅" },
  { href: "/monthly", label: "דוח חודשי", icon: "📊" },
] as const;

export default function Nav() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (pathname === "/login") return null;

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-l border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 px-2 text-lg font-semibold">מרכז הפיקוד</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <a
          href="https://dinar.finbot.co.il"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          ↗ פתח דינרוז
        </a>
        {email && (
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-500" dir="ltr">
            <span className="truncate">{email}</span>
            <button
              type="button"
              onClick={signOut}
              className="text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              יציאה
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
