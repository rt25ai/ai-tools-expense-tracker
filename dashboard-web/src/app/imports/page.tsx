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
      />
      <ManualReceiptImportClient
        knownVendors={model.settings.vendors.knownVendors}
        initialReceipts={manualReceipts}
      />
    </>
  );
}
