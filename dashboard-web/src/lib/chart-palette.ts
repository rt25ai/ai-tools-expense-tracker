export const chartPalette = [
  "#22d3ee",
  "#38bdf8",
  "#fbbf24",
  "#34d399",
  "#f87171",
  "#a3e635",
] as const;

export function getChartColor(index: number) {
  return chartPalette[index % chartPalette.length];
}
