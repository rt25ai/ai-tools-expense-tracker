import type { ReactNode } from "react";
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(68,211,146,0.12),transparent_36%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%)]" />
      <div className="relative flex min-h-screen">
        <SidebarNav />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="border-b border-white/6 bg-black/10 px-4 py-3 backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-emerald-300/70">
                  מסוף תפעולי RT-AI
                </p>
                <p className="text-sm text-zinc-400">
                  פיננסים, ספקים, ייבוא, סקירה ודיווח במשטח אחד.
                </p>
              </div>
              <div className="rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-1 text-xs text-emerald-200">
                ייצוא סטטי חי
              </div>
            </div>
          </div>
          <MobileNav />
          <main className="flex-1 px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-10">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
