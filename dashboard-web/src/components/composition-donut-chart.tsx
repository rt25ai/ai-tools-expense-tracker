import { formatCurrencyIls } from "@/lib/formatters";

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

function percentLabel(value: number, total: number) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

export function CompositionDonutChart({
  data,
  centerLabel,
}: {
  data: DonutDatum[];
  centerLabel: string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (!total) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-black/20 text-sm text-zinc-500">
        אין מספיק נתונים להצגת החלוקה.
      </div>
    );
  }

  const radius = 82;
  const circumference = 2 * Math.PI * radius;

  const segments = data.reduce<{
    offset: number;
    items: (DonutDatum & { dashLength: number; dashOffset: number; percent: string })[];
  }>(
    (accumulator, entry) => {
      const rawLength = (entry.value / total) * circumference;
      const gap = data.length > 1 ? 3 : 0;

      return {
        offset: accumulator.offset + rawLength,
        items: [
          ...accumulator.items,
          {
            ...entry,
            dashLength: Math.max(rawLength - gap, 0),
            dashOffset: -accumulator.offset,
            percent: percentLabel(entry.value, total),
          },
        ],
      };
    },
    { offset: 0, items: [] },
  ).items;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div className="relative mx-auto h-[230px] w-full max-w-[280px] sm:h-[260px]">
        <svg aria-label={centerLabel} className="h-full w-full" role="img" viewBox="0 0 240 240">
          <circle cx="120" cy="120" fill="none" r={radius} stroke="#ffffff12" strokeWidth="28" />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="120"
              cy="120"
              fill="none"
              r={radius}
              stroke={segment.color}
              strokeDasharray={`${segment.dashLength} ${circumference - segment.dashLength}`}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="round"
              strokeWidth="28"
              transform="rotate(-90 120 120)"
            >
              <title>
                {segment.label}: {formatCurrencyIls(segment.value)} ({segment.percent})
              </title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xs tracking-[0.18em] text-zinc-500">{centerLabel}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatCurrencyIls(total)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((entry) => (
          <div key={entry.label} className="rounded-[18px] border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <p className="truncate text-sm font-medium text-white">{entry.label}</p>
              </div>
              <p className="text-sm text-zinc-400">{entry.percent}</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-cyan-200">{formatCurrencyIls(entry.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
