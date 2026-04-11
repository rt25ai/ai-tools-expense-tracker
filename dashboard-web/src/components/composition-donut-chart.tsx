"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrencyIls } from "@/lib/formatters";
import { useHydrated } from "@/lib/use-hydrated";

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

function numericValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function CompositionDonutChart({
  data,
  centerLabel,
}: {
  data: DonutDatum[];
  centerLabel: string;
}) {
  const hydrated = useHydrated();
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (!total) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 text-sm text-zinc-500">
        אין מספיק נתונים להצגת תרשים.
      </div>
    );
  }

  if (!hydrated) {
    return <div className="h-[280px] w-full animate-pulse rounded-[24px] bg-white/[0.03]" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <div className="relative h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                borderColor: "rgba(255,255,255,0.08)",
                borderRadius: "18px",
                background: "rgba(9,12,16,0.92)",
                color: "#f4f4f5",
              }}
              formatter={(value) => formatCurrencyIls(numericValue(value))}
            />
            <Pie
              cx="50%"
              cy="50%"
              data={data}
              dataKey="value"
              innerRadius={70}
              outerRadius={96}
              paddingAngle={4}
              stroke="transparent"
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs tracking-[0.22em] text-zinc-500">{centerLabel}</p>
          <p className="mt-3 text-2xl font-semibold text-white">{formatCurrencyIls(total)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {data.map((entry) => {
          const share = total ? (entry.value / total) * 100 : 0;

          return (
            <div key={entry.label} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <p className="text-sm font-medium text-white">{entry.label}</p>
                </div>
                <p className="text-sm text-zinc-300">{share.toFixed(0)}%</p>
              </div>
              <p className="mt-3 text-lg font-semibold text-cyan-100">{formatCurrencyIls(entry.value)}</p>
              <div className="mt-3 h-2 rounded-full bg-white/[0.05]">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.max(share, 6)}%`, backgroundColor: entry.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
