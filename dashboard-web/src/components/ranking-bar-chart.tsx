import { formatCurrencyIls } from "@/lib/formatters";

type RankingDatum = {
  label: string;
  value: number;
  color: string;
};

export function RankingBarChart({
  data,
  valueLabel = "סכום",
}: {
  data: RankingDatum[];
  valueLabel?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-black/20 text-sm text-zinc-500">
        אין מספיק נתונים להצגת דירוג.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <div aria-label={valueLabel} className="space-y-3" role="list">
      {data.map((entry, index) => {
        const width = `${Math.max((entry.value / maxValue) * 100, 4)}%`;

        return (
          <div
            key={entry.label}
            className="grid gap-3 rounded-[18px] border border-white/8 bg-black/20 p-4 sm:grid-cols-[minmax(0,9rem)_1fr_auto] sm:items-center"
            role="listitem"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{entry.label}</p>
              <p className="mt-1 text-xs text-zinc-500">#{index + 1}</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width, backgroundColor: entry.color }} />
            </div>
            <p className="text-sm font-semibold text-cyan-200 sm:text-left">{formatCurrencyIls(entry.value)}</p>
          </div>
        );
      })}
    </div>
  );
}
