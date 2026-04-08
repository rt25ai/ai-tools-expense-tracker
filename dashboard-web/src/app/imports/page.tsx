import { PageHeader } from "@/components/page-header";
import { ManualReceiptImportClient } from "@/components/manual-receipt-import-client";
import { getDashboardModel } from "@/lib/dashboard-data";
import { getManualReceipts } from "@/lib/manual-receipts";

export default function ImportsPage() {
  const model = getDashboardModel();
  const manualReceipts = getManualReceipts();

  return (
    <>
      <PageHeader
        eyebrow="ייבוא ידני"
        title="קבלות שלא מגיעות למייל"
        description="כאן אפשר להזין ידנית חיוב שחסר במערכת, או להעלות קבלת PDF שנמשכה מחשבון הספק. הזרימה הזו מעדכנת את קובץ המקור, את האקסל ואת הדשבורד יחד."
      />
      <ManualReceiptImportClient
        knownVendors={model.settings.vendors.knownVendors}
        initialReceipts={manualReceipts.slice(0, 8)}
      />
    </>
  );
}
