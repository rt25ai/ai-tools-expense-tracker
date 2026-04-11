import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChartFrame({
  eyebrow,
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("border-white/8 bg-white/[0.03] p-6 shadow-none", className)}>
      <div className="flex flex-col gap-4 border-b border-white/6 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-zinc-500">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("mt-6", contentClassName)}>{children}</div>
    </Card>
  );
}
