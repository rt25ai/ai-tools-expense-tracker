"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, Bot, House, ReceiptText, Settings2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { withBasePath } from "@/lib/site";

export const navigation = [
  { href: "/", label: "ראשי", icon: House },
  { href: "/transactions", label: "עסקאות", icon: ArrowRightLeft },
  { href: "/vendors", label: "ספקים", icon: UsersRound },
  { href: "/automations", label: "אוטומציות", icon: Bot },
  { href: "/settings", label: "הגדרות", icon: Settings2 },
];

function isItemActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname === "/overview" : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-l border-white/6 bg-[#090c10] px-6 py-7 lg:flex lg:flex-col">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 p-2 shadow-[0_0_30px_rgba(44,214,223,0.12)]">
          <Image src={withBasePath("/logo.png")} alt="RT-AI" width={34} height={34} className="rounded-lg" unoptimized />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">מעקב הוצאות כלי AI</p>
          <p className="text-xs text-zinc-500">הגדרות פרויקט ותפעול</p>
        </div>
      </div>

      <div className="mt-10 space-y-1">
        {navigation.map((item) => {
          const isActive = isItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors",
                isActive
                  ? "bg-cyan-400/12 text-white ring-1 ring-cyan-400/20"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.18em] text-zinc-500">מצב נוכחי</p>
            <p className="mt-2 text-lg font-semibold text-zinc-100">דשבורד סטטי</p>
          </div>
          <ReceiptText className="size-4 text-cyan-300" />
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          הממשק כבר בנוי כמו מערכת תפעול אמיתית, כך שבהמשך נוכל לחבר אוטומציות חיות בלי לעצב הכול מחדש.
        </p>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-white/6 px-4 py-3 lg:hidden md:px-8">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 overflow-x-auto pb-1">
        {navigation.map((item) => {
          const isActive = isItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm whitespace-nowrap transition-colors",
                isActive
                  ? "border-cyan-400/20 bg-cyan-400/12 text-white"
                  : "border-white/8 bg-white/[0.03] text-zinc-400 hover:text-zinc-100",
              )}
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-400">
          פריסה חיה
        </Badge>
      </div>
    </div>
  );
}
