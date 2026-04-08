import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/20 p-2 text-zinc-500">
          <ArrowUpRight className="size-4" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{hint}</p>
    </Card>
  );
}
