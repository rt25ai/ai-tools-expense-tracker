import Link from "next/link";
import { ArrowUpLeft, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { BudgetBars } from "@/components/budget-bars";
import { Heatmap } from "@/components/heatmap";
import { OverviewKpiGrid } from "@/components/overview-kpi-grid";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatDateLabel, formatDateTimeLabel, formatExchangeRate } from "@/lib/formatters";

export function OverviewView() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="ראשי"
        title="תמונת מצב תפעולית"
        description="מסך עבודה מהודק לניהול הוצאות, חיובים חוזרים, בדיקות ידניות ובריאות ספקים. המטרה היא להרגיש כמו מערכת תפעול אמיתית, לא רק עמוד תצוגה."
        actions={
          <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
            <Link href="/transactions">
              פתח עסקאות
              <ArrowUpLeft className="size-4" />
            </Link>
          </Button>
        }
      />

      <OverviewKpiGrid model={model} />

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">מפת חום חודשית</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">לחץ תקציבי לפי חודש</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                מפת החום מחליפה את התצוגה הישנה ועוזרת לזהות חודשים כבדים, בסיסי חיוב עתידיים וריכוזי הוצאה בשקלים.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
                {model.monthlySeries.length} חודשים במעקב
              </Badge>
              <Badge variant="outline" className="border-cyan-400/15 bg-cyan-400/8 text-cyan-200">
                {formatExchangeRate(model.raw.usd_rate)}
              </Badge>
            </div>
          </div>
          <div className="mt-6">
            <Heatmap data={model.monthlySeries} />
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500">חלוקת חיובים</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">חוזר מול חד־פעמי</h2>
          <div className="mt-6 space-y-5">
            {model.recurringSeries.map((entry) => (
              <div key={entry.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-zinc-100">{entry.label}</p>
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-100">{formatCurrencyIls(entry.value)}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{Math.round(entry.share * 100)}%</p>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-white/[0.05]">
                  <div className="h-3 rounded-full bg-cyan-400" style={{ width: `${Math.max(entry.share * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-cyan-400/15 bg-cyan-400/7 p-4">
            <p className="text-sm font-medium text-cyan-100">עדכון שער</p>
            <p className="mt-2 text-sm leading-6 text-cyan-50/80">
              שער הדולר נמשך אוטומטית ממקור רשמי. עודכן לאחרונה:
              {" "}
              {model.raw.exchange_rate_updated_at ? formatDateTimeLabel(model.raw.exchange_rate_updated_at) : "לא התקבל זמן עדכון"}
              .
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{model.raw.exchange_rate_source ?? "Bank of Israel Public API"}</p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">תקציב מול בפועל</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">פער חודשי מהיעד</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                מציג עד כמה כל חודש סטה מהיעד לאחר הוספת כל ההתחייבויות החוזרות.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              תקציב עבודה
            </Badge>
          </div>
          <div className="mt-6">
            <BudgetBars months={model.monthlySeries.filter((entry) => entry.key.startsWith("2026"))} />
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">דורש בדיקה</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">תור שמחכה לאישור אנושי</h2>
            </div>
            <Button asChild variant="outline" className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]">
              <Link href="/vendors">פתח מסך ספקים</Link>
            </Button>
          </div>
          <div className="mt-6 space-y-3">
            {model.needsReview.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.vendor}</p>
                    <p className="mt-1 text-sm text-zinc-500">{formatDateLabel(item.date)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      item.severity === "high"
                        ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                        : item.severity === "medium"
                          ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                          : "border-sky-400/20 bg-sky-400/10 text-sky-200"
                    }
                  >
                    {item.severity === "high" ? "גבוה" : item.severity === "medium" ? "בינוני" : "נמוך"}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-zinc-300">{formatCurrencyIls(item.amount)}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{item.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">יומן שינויים אחרון</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מה השתנה בתהליך</h2>
            </div>
            <Badge variant="outline" className="border-cyan-400/15 bg-cyan-400/8 text-cyan-200">
              {model.raw.generated}
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            {model.auditLog.map((event) => (
              <div key={event.id} className="flex gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="mt-1 rounded-full border border-cyan-400/15 bg-cyan-400/8 p-2 text-cyan-300">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{event.detail}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-zinc-500">{event.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500">מצב המערכת</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">מדדי איכות של הממשק</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-cyan-300" />
                <p className="font-medium text-white">רישום הספקים מפורש וברור</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                כל ספק מוצג עם סוג חיוב, מקור נתונים, בעלים ורמת אמינות של הזיהוי.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <CircleAlert className="size-4 text-amber-300" />
                <p className="font-medium text-white">זרימות ידניות מופרדות</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                חיובים ידניים וחד־פעמיים מופרדים בבירור מהוצאות חוזרות שמגיעות מהייבוא האוטומטי.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <ArrowUpLeft className="size-4 text-sky-300" />
                <p className="font-medium text-white">מוכן לשכבת אוטומציה חיה</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                המעטפת, הניווט וההגדרות כבר מוכנים לחיבור עתידי של Gmail, ניתוח AI ו־API של ספקים.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
