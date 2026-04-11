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
        eyebrow="עסקאות"
        title="יומן עסקאות מלא"
        actions={<Button className="bg-cyan-400 text-black hover:bg-cyan-300">בדוק חריגים</Button>}
      />

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="mb-6 flex flex-col gap-3 border-b border-white/6 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-zinc-500">כלי טבלה</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">ניווט ברמת תפעול</h2>
          </div>
        </div>
        <TransactionsTable data={model.transactions} />
      </Card>
    </>
  );
}
