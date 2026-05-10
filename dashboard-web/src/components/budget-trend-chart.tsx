import { formatCurrencyIls } from "@/lib/formatters";

type TrendDatum = {
  label: string;
  total: number;
  budget: number;
};

type Point = {
  x: number;
  y: number;
  datum: TrendDatum;
};

const WIDTH = 720;
const HEIGHT = 280;
const PADDING = {
  top: 22,
  right: 22,
  bottom: 44,
  left: 46,
};

function formatCompactValue(value: number) {
  return new Intl.NumberFormat("he-IL", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function buildPoints(data: TrendDatum[], maxValue: number, field: "total" | "budget") {
  const drawableWidth = WIDTH - PADDING.left - PADDING.right;
  const drawableHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const step = data.length > 1 ? drawableWidth / (data.length - 1) : 0;

  return data.map((datum, index) => ({
    x: PADDING.left + step * index,
    y: PADDING.top + drawableHeight - (datum[field] / maxValue) * drawableHeight,
    datum,
  }));
}

function pointsToPath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function BudgetTrendChart({ data }: { data: TrendDatum[] }) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-black/20 text-sm text-zinc-500">
        אין מספיק נתונים להצגת מגמה.
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap((entry) => [entry.total, entry.budget]), 1);
  const totalPoints = buildPoints(data, maxValue, "total");
  const budgetPoints = buildPoints(data, maxValue, "budget");
  const baselineY = HEIGHT - PADDING.bottom;
  const areaPath = `${pointsToPath(totalPoints)} L ${totalPoints[totalPoints.length - 1].x} ${baselineY} L ${totalPoints[0].x} ${baselineY} Z`;
  const guideValues = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="w-full">
      <svg className="h-[280px] w-full" role="img" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <title>בפועל מול יעד חודשי</title>
        <defs>
          <linearGradient id="budget-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {guideValues.map((ratio) => {
          const y = PADDING.top + (1 - ratio) * (HEIGHT - PADDING.top - PADDING.bottom);
          const label = formatCompactValue(maxValue * ratio);

          return (
            <g key={ratio}>
              <line stroke="#ffffff12" strokeDasharray="3 8" x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} />
              <text fill="#71717a" fontSize="11" textAnchor="end" x={PADDING.left - 10} y={y + 4}>
                {label}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#budget-trend-fill)" />
        <path d={pointsToPath(totalPoints)} fill="none" stroke="#22d3ee" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <path
          d={pointsToPath(budgetPoints)}
          fill="none"
          stroke="#fbbf24"
          strokeDasharray="7 7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />

        {totalPoints.map((point) => (
          <g key={point.datum.label}>
            <circle cx={point.x} cy={point.y} fill="#020617" r="5" stroke="#22d3ee" strokeWidth="3">
              <title>
                {point.datum.label}: {formatCurrencyIls(point.datum.total)}
              </title>
            </circle>
            <text fill="#a1a1aa" fontSize="12" textAnchor="middle" x={point.x} y={HEIGHT - 14}>
              {point.datum.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="inline-flex items-center gap-2 text-cyan-100">
          <span className="h-2 w-6 rounded-full bg-cyan-300" />
          בפועל
        </span>
        <span className="inline-flex items-center gap-2 text-amber-100">
          <span className="h-2 w-6 rounded-full border-t-2 border-dashed border-amber-300" />
          יעד
        </span>
      </div>
    </div>
  );
}
