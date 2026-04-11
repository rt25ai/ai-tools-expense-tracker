"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrencyIls } from "@/lib/formatters";
import { useHydrated } from "@/lib/use-hydrated";

function formatCompactValue(value: number) {
  return new Intl.NumberFormat("he-IL", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function numericValue(value: unknown) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function BudgetTrendChart({
  data,
}: {
  data: { label: string; total: number; budget: number }[];
}) {
  const hydrated = useHydrated();
  const gradientId = useId().replace(/:/g, "");

  if (!hydrated) {
    return <div className="h-[280px] w-full animate-pulse rounded-[24px] bg-white/[0.03]" />;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id={`${gradientId}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55} />
              <stop offset="65%" stopColor="#38bdf8" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ffffff12" strokeDasharray="3 8" />
          <XAxis
            axisLine={false}
            dataKey="label"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#71717b", fontSize: 11 }}
            tickFormatter={formatCompactValue}
            tickLine={false}
            tickMargin={10}
          />
          <Tooltip
            cursor={{ stroke: "#ffffff18", strokeDasharray: "4 6" }}
            contentStyle={{
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: "18px",
              background: "rgba(9,12,16,0.92)",
              color: "#f4f4f5",
            }}
            formatter={(value, name) => [
              formatCurrencyIls(numericValue(value)),
              name === "total" ? "בפועל" : "יעד",
            ]}
            labelFormatter={(label) => `חודש: ${label}`}
          />
          <Area
            dataKey="total"
            fill={`url(#${gradientId}-fill)`}
            fillOpacity={1}
            name="total"
            stroke="#22d3ee"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            dataKey="budget"
            dot={false}
            name="budget"
            stroke="#fbbf24"
            strokeDasharray="6 6"
            strokeWidth={2}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
