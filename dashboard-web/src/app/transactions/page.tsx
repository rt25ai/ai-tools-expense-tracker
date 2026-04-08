import { PageHeader } from "@/components/page-header";
import { TransactionsTable } from "@/components/transactions-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel } from "@/lib/dashboard-data";

export default function TransactionsPage() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="Transactions"
        title="Full transaction log"
        description="This replaces the old flat table with a proper working surface: search, multi-sort, source filters, export, and vendor-aware metadata."
        actions={<Button className="bg-emerald-500 text-black hover:bg-emerald-400">Review exceptions</Button>}
      />

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="mb-6 flex flex-col gap-3 border-b border-white/6 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Table controls</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Operator-grade browsing</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            Local pagination now behaves like a real data console and is structured so server pagination can be added later without redesigning the page.
          </p>
        </div>
        <TransactionsTable data={model.transactions} />
      </Card>
    </>
  );
}
