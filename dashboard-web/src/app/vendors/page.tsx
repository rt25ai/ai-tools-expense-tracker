import { CheckCircle2, CircleAlert, CircleDot } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel, getSourceLabel } from "@/lib/dashboard-data";
import { formatCurrencyUsd, formatDateLabel } from "@/lib/formatters";

export default function VendorsPage() {
  const model = getDashboardModel();
  const recurringVendors = model.vendors.filter((vendor) => vendor.recurring).length;

  return (
    <>
      <PageHeader
        eyebrow="ספקים"
        title="רישום ספקים ובריאות חיובים"
        description="לכל ספק יש עכשיו סטטוס חוזר, מקור חשבונית, רמת אמינות וסטטוס תפעולי, כדי להבין מה יציב ומה עדיין דורש השגחה."
        actions={<Button className="bg-emerald-500 text-black hover:bg-emerald-400">בדוק כללי ספקים</Button>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">ספקים במעקב</p>
          <p className="mt-4 text-3xl font-semibold text-white">{model.vendors.length}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">ספקים חוזרים</p>
          <p className="mt-4 text-3xl font-semibold text-white">{recurringVendors}</p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <p className="text-xs tracking-[0.18em] text-zinc-500">ספקים ידניים / לבדיקה</p>
          <p className="mt-4 text-3xl font-semibold text-white">
            {model.vendors.filter((vendor) => vendor.status !== "healthy").length}
          </p>
        </Card>
      </section>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-white/6 pb-6">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-zinc-500">רישום</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">מסך ספקים</h2>
          </div>
          <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
            מבוסס אמינות
          </Badge>
        </div>
        <div className="space-y-4">
          {model.vendors.map((vendor) => (
            <div key={vendor.name} className="grid gap-5 rounded-[26px] border border-white/8 bg-black/20 p-5 xl:grid-cols-[1.5fr_0.9fr_0.9fr_1fr]">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-white">{vendor.name}</p>
                  <Badge
                    variant="outline"
                    className={
                      vendor.status === "healthy"
                        ? "border-emerald-400/15 bg-emerald-400/8 text-emerald-200"
                        : vendor.status === "watch"
                          ? "border-amber-400/15 bg-amber-400/8 text-amber-200"
                          : "border-white/10 bg-white/[0.05] text-zinc-300"
                    }
                  >
                    {vendor.status === "healthy" ? "תקין" : vendor.status === "watch" ? "לבדיקה" : "ידני"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-500">{vendor.category}</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">{vendor.notes}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-zinc-500">מצב מסחרי</p>
                <p className="text-sm text-zinc-100">{vendor.recurring ? "חיוב חוזר" : "חד־פעמי / משתנה"}</p>
                <p className="text-sm text-zinc-400">
                  צפוי: {vendor.expectedAmount ? formatCurrencyUsd(vendor.expectedAmount) : "משתנה"}
                </p>
                <p className="text-sm text-zinc-400">החודש: {formatCurrencyUsd(vendor.currentMonthSpend)}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-zinc-500">נתונים תפעוליים</p>
                <p className="text-sm text-zinc-100">{getSourceLabel(vendor.source)}</p>
                <p className="text-sm text-zinc-400">אמינות: {Math.round(vendor.confidence * 100)}%</p>
                <p className="text-sm text-zinc-400">אחראי: {vendor.owner}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs tracking-[0.18em] text-zinc-500">חיוב אחרון</p>
                <p className="text-sm text-zinc-100">
                  {vendor.lastChargeDate ? formatDateLabel(vendor.lastChargeDate) : "עדיין אין חיוב"}
                </p>
                <p className="text-sm text-zinc-400">
                  חיוב צפוי הבא: {vendor.nextExpectedDate ? formatDateLabel(vendor.nextExpectedDate) : "לא מתוזמן"}
                </p>
                <p className="text-sm text-emerald-200">סך הכל: {formatCurrencyUsd(vendor.totalSpend)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-4 text-emerald-300" />
            <h3 className="font-semibold text-white">תקין</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            ספקים חוזרים עם יבוא ממייל, רמת אמינות גבוהה ותזמון חיוב צפוי.
          </p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-center gap-3">
            <CircleAlert className="size-4 text-amber-300" />
            <h3 className="font-semibold text-white">לבדיקה</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            ספקים מיובאים או חוזרים שעדיין מציגים מספיק חריגות כדי להצדיק בדיקה תקופתית.
          </p>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-center gap-3">
            <CircleDot className="size-4 text-zinc-300" />
            <h3 className="font-semibold text-white">ידני</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            ספקים שעדיין מתוחזקים ידנית עד שנחבר להם יבוא דטרמיניסטי או API ישיר.
          </p>
        </Card>
      </section>
    </>
  );
}
