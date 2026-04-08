import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { Heatmap } from "@/components/heatmap";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { BudgetBars } from "@/components/budget-bars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel } from "@/lib/dashboard-data";
import { formatCurrencyIls, formatCurrencyUsd, formatDateLabel } from "@/lib/formatters";

export function OverviewView() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="סקירה כללית"
        title="מבט מהיר על ניהול הוצאות"
        description="משטח תפעולי מהוקצע לפיננסים, כללי חיוב חוזר, תור בדיקה ובריאות ספקים. בנוי להרגיש כמו מסוף אדמין אמיתי, לא דשבורד דקורטיבי."
        actions={
          <Button asChild className="bg-emerald-500 text-black hover:bg-emerald-400">
            <Link href="/transactions">
              פתח עסקאות
              <ArrowUpRight className="ms-2 size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="סה״כ מתחילת השנה"
          value={formatCurrencyUsd(model.stats.totalYtd)}
          hint="הוצאות מתחילת השנה על פני מנויים, תשלומים מראש, פרסום ותשלומי ספקים חד-פעמיים."
        />
        <KpiCard
          label="חודש נוכחי"
          value={formatCurrencyUsd(model.stats.currentMonth)}
          hint={`שווה ל-${formatCurrencyIls(model.raw.current_month_total_ils)} בספר העבודה.`}
        />
        <KpiCard
          label="בסיס חיובים חוזרים"
          value={formatCurrencyUsd(model.stats.recurringBaseline)}
          hint="שריפת כסף חודשית צפויה לפני פרסום משתנה, חבילות קרדיט וחריגים ידניים."
        />
        <KpiCard
          label="חיובים בלתי צפויים"
          value={String(model.stats.unexpectedCharges)}
          hint="עסקאות החודש שעדיין זקוקות לסקירת מפעיל כי הן ידניות, משתנות, או חד-פעמיות."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">מפת חום חודשית</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">לחץ תקציבי לפי חודש</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                מפת החום מחליפה את הצגת הגרף הגנרית הישנה ומקלה לזהות חודשים כבדים, בסיסי חיוב עתידיים וריכוז הוצאות.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              {model.monthlySeries.length} חודשים במעקב
            </Badge>
          </div>
          <div className="mt-6">
            <Heatmap data={model.monthlySeries} />
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">פרופיל חיובים</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">חוזר לעומת חד-פעמי</h2>
          <div className="mt-6 space-y-5">
            {model.recurringSeries.map((entry) => (
              <div key={entry.label} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium text-zinc-100">{entry.label}</p>
                  <div className="text-start">
                    <p className="text-sm font-medium text-zinc-100">{formatCurrencyUsd(entry.value)}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {Math.round(entry.share * 100)}%
                    </p>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-white/[0.05]">
                  <div className="h-3 rounded-full bg-emerald-400" style={{ width: `${Math.max(entry.share * 100, 8)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-amber-400/15 bg-amber-400/7 p-4">
            <p className="text-sm font-medium text-amber-100">הערת מפעיל</p>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">
              פרסום ממומן משתנה וקרדיטים ידניים הם עדיין הסיבה העיקרית לכך שהמסוף זקוק לתור בדיקה.
            </p>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">תקציב לעומת בפועל</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">סטייה תפעולית חודשית</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                מציג עד כמה כל חודש סטה מיעד ההוצאות לאחר הוספת התחייבויות החוזרות.
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
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">דורש בדיקה</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">תור שעדיין זקוק לאדם</h2>
            </div>
            <Button asChild variant="outline" className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]">
              <Link href="/vendors">פתח תצוגת ספקים</Link>
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
                <p className="mt-3 text-sm text-zinc-300">{formatCurrencyUsd(item.amount)}</p>
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
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">יומן ביקורת אחרון</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מה השתנה בצינור</h2>
            </div>
            <Badge variant="outline" className="border-emerald-400/15 bg-emerald-400/8 text-emerald-200">
              {model.raw.generated}
            </Badge>
          </div>
          <div className="mt-6 space-y-4">
            {model.auditLog.map((event) => (
              <div key={event.id} className="flex gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="mt-1 rounded-full border border-emerald-400/15 bg-emerald-400/8 p-2 text-emerald-300">
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
          <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">מצב המערכת</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">אותות איכות המסוף</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-4 text-emerald-300" />
                <p className="font-medium text-white">רישום הספקים הוא מפורש</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                כל ספק מוצג עם מצב חוזר, מקור, בעלים ורמת ביטחון בפרסור.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <CircleAlert className="size-4 text-amber-300" />
                <p className="font-medium text-white">תהליכים ידניים מבודדים</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                חיובים ידניים וחד-פעמיים נפרדים כעת באופן ברור מהוצאות חוזרות המגובות ביבואן.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="size-4 text-sky-300" />
                <p className="font-medium text-white">מוכן לאוטומציה חיה בשלב הבא</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                הקליפה, המסלולים ומשטח ההגדרות מוכנים לחיבור Gmail, פרסור AI וממשקי API של ספקים.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </>
  );
}
