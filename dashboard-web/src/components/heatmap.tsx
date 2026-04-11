import { formatCurrencyIls, formatMonthLabel } from "@/lib/formatters";

export function Heatmap({
  data,
}: {
  data: { key: string; label: string; total: number; intensity: number }[];
}) {
  const maxIndex = data.reduce((best, m, i) => (m.total > data[best].total ? i : best), 0);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-end gap-3">
        <span className="text-[11px] text-zinc-500">נמוך</span>
        <div
          className="h-2.5 w-28 rounded-full"
          style={{
            background:
              "linear-gradient(to left, rgba(44,214,223,0.9), rgba(44,214,223,0.12))",
          }}
        />
        <span className="text-[11px] text-zinc-500">גבוה</span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {data.map((month, i) => {
          const isPeak = i === maxIndex;
          const barWidth = Math.max(4, Math.round(month.intensity * 100));

          return (
            <div
              key={month.key}
              className={`relative rounded-2xl border p-4 transition-colors ${
                isPeak
                  ? "border-cyan-400/40 bg-cyan-950/30"
                  : "border-white/8 bg-white/[0.03]"
              }`}
            >
              {isPeak && (
                <span className="absolute right-3 top-3 rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-300">
                  שיא
                </span>
              )}

              {/* Month name + year */}
              <p className="text-xs font-semibold text-zinc-100">
                {formatMonthLabel(month.key, "short")}
              </p>

              {/* Amount */}
              <p
                className={`mt-1 text-base font-bold tabular-nums ${
                  isPeak ? "text-cyan-300" : "text-zinc-100"
                }`}
              >
                {formatCurrencyIls(month.total)}
              </p>

              {/* Intensity bar */}
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barWidth}%`,
                    background: `rgba(44,214,223,${0.3 + month.intensity * 0.7})`,
                  }}
                />
              </div>

              {/* Percentage of max */}
              <p className="mt-1.5 text-[11px] text-zinc-500">
                {Math.round(month.intensity * 100)}% מהשיא
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
