"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrencyIls } from "@/lib/formatters";
import { useHydrated } from "@/lib/use-hydrated";

type RankingDatum = {
  label: string;
  value: number;
  color: string;
};

function numericValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function RankingBarChart({
  data,
  valueLabel = "סכום",
}: {
  data: RankingDatum[];
  valueLabel?: string;
}) {
  const hydrated = useHydrated();

  if (!data.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-black/20 text-sm text-zinc-500">
        אין מספיק נתונים להצגת דירוג.
      </div>
    );
  }

  const chartHeight = Math.max(280, data.length * 54);

  if (!hydrated) {
    return <div className="w-full animate-pulse rounded-[24px] bg-white/[0.03]" style={{ height: chartHeight }} />;
  }

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 0 }}>
          <XAxis hide type="number" />
          <YAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "#d4d4d8", fontSize: 12 }}
            tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
            tickLine={false}
            type="category"
            width={110}
          />
          <Tooltip
            contentStyle={{
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: "18px",
              background: "rgba(9,12,16,0.92)",
              color: "#f4f4f5",
            }}
            formatter={(value) => [formatCurrencyIls(numericValue(value)), valueLabel]}
          />
          <Bar barSize={26} dataKey="value" radius={[10, 10, 10, 10]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
            <LabelList
              dataKey="value"
              fill="#f4f4f5"
              formatter={(value) => formatCurrencyIls(numericValue(value))}
              position="right"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
