import { ArrowUpLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  hint: string;
  active?: boolean;
  onClick?: () => void;
};

export function KpiCard({ label, value, hint, active = false, onClick }: KpiCardProps) {
  const className = cn(
    "w-full border-white/8 bg-white/[0.03] p-5 text-right shadow-none transition-all",
    onClick ? "cursor-pointer hover:border-cyan-400/20 hover:bg-white/[0.045]" : "",
    active ? "border-cyan-400/30 bg-cyan-400/[0.08] ring-1 ring-cyan-400/20" : "",
  );

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="order-2">
          <p className="text-xs tracking-[0.18em] text-zinc-500">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div
          className={cn(
            "order-1 rounded-full border p-2 text-zinc-500 transition-colors",
            active
              ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200"
              : "border-white/10 bg-black/20",
          )}
        >
          <ArrowUpLeft className="size-4" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{hint}</p>
    </>
  );

  if (!onClick) {
    return <Card className={className}>{content}</Card>;
  }

  return (
    <button type="button" onClick={onClick} className="w-full text-right" aria-pressed={active}>
      <Card className={className}>{content}</Card>
    </button>
  );
}
