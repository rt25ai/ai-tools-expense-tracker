import type { ReactNode } from "react";
import { MobileNav, SidebarNav } from "@/components/sidebar-nav";
import { getDashboardModel } from "@/lib/dashboard-data";
import { formatDateLabel } from "@/lib/formatters";

export function AppShell({ children }: { children: ReactNode }) {
  const model = getDashboardModel();
  const lastSyncedLabel = formatDateLabel(model.raw.generated);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(44,214,223,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(112,247,255,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(8,109,125,0.12),transparent_30%)]" />
      <div className="relative flex min-h-screen">
        <SidebarNav />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div className="border-b border-white/6 bg-black/10 px-4 py-3 backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-cyan-300/70">מרכז התפעול של RT-AI</p>
                <p className="text-sm text-zinc-400">הוצאות AI וכלים עסקיים, ספקים, ייבוא חשבוניות, בדיקות ודוחות במקום אחד.</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="rounded-full border border-cyan-400/15 bg-cyan-400/8 px-3 py-1 text-xs text-cyan-200">
                  פריסה חיה
                </div>
                <p className="text-xs text-zinc-500">סנכרון אחרון: {lastSyncedLabel}</p>
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
