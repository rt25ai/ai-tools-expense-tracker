import { monthToken } from "@/lib/formatters";

export function Heatmap({
  data,
}: {
  data: { key: string; label: string; total: number; intensity: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {data.map((month) => (
        <div key={month.key} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
          <div
            className="h-24 rounded-2xl border border-white/6"
            style={{
              background: `linear-gradient(180deg, rgba(68,211,146,${0.18 + month.intensity * 0.42}), rgba(255,255,255,0.02))`,
            }}
          />
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{monthToken(month.key)}</p>
              <p className="mt-2 text-sm font-medium text-zinc-100">{month.label}</p>
            </div>
            <p className="text-sm font-medium text-emerald-200">${month.total.toFixed(0)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
