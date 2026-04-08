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
        description="הטבלה הישנה הוחלפה במשטח עבודה אמיתי: חיפוש, מיון מרובה, פילטרי מקור, ייצוא ומטא-נתונים מודעי-ספק."
        actions={<Button className="bg-emerald-500 text-black hover:bg-emerald-400">סקור חריגים</Button>}
      />

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="mb-6 flex flex-col gap-3 border-b border-white/6 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">בקרת טבלה</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">גלישה ברמת מפעיל</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-zinc-400">
            עימוד מקומי שמתנהג כמסוף נתונים אמיתי ומובנה כך שניתן להוסיף עימוד שרת מאוחר יותר מבלי לעצב מחדש את הדף.
          </p>
        </div>
        <TransactionsTable data={model.transactions} />
      </Card>
    </>
  );
}
