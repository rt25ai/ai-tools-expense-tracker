import type { ToolsExpenseSnapshot } from "./types";

// Public read-only JSON published by the existing tracker (GitHub Pages)
const PUBLIC_TOOLS_JSON_URL =
  process.env.NEXT_PUBLIC_TOOLS_DATA_URL ||
  "https://rt25ai.github.io/ai-tools-expense-tracker/data.json";

export async function fetchToolsSnapshot(): Promise<ToolsExpenseSnapshot> {
  const res = await fetch(PUBLIC_TOOLS_JSON_URL, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch tools snapshot: HTTP ${res.status}`);
  }
  return (await res.json()) as ToolsExpenseSnapshot;
}
