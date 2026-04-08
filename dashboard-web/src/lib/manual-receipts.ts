import fs from "node:fs";
import path from "node:path";

export type ManualReceiptRecord = {
  id: string;
  date: string;
  tool: string;
  description: string;
  currency: "USD" | "ILS";
  original_amount: number;
  attachment_path?: string | null;
  attachment_name?: string | null;
  entry_mode?: string | null;
  notes?: string | null;
  created_at?: string | null;
  entry_source?: string | null;
};

export function getManualReceipts(): ManualReceiptRecord[] {
  const filePath = path.join(process.cwd(), "..", "manual_receipts.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ManualReceiptRecord[];
    return [...payload].sort((left, right) => right.date.localeCompare(left.date));
  } catch {
    return [];
  }
}
