import Link from "next/link";
import { ArrowUpLeft, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMonthReports, getReportYears, getYearReport } from "@/lib/dashboard-data";
import { formatCurrencyIls } from "@/lib/formatters";
import { monthReportHref, yearReportHref } from "@/lib/report-links";

export default function ReportsPage() {
  const months = getMonthReports();
  const years = getReportYears();
  const latestMonths = [...months].sort((left, right) => right.key.localeCompare(left.key)).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="דוחות"
        title="ארכיון דוחות חודשי ושנתי"
        description="מכאן אפשר לעבור לכל חודש בנפרד, לראות סיכומים שנתיים, ולהיכנס מכל שנה אל פירוט החודשים שמרכיבים אותה."
        actions={
          latestMonths[0] ? (
            <Button asChild className="bg-cyan-400 text-black hover:bg-cyan-300">
              <Link href={monthReportHref(latestMonths[0].key)}>
                פתח את הדוח האחרון
                <ArrowUpLeft className="size-4" />
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 xl:grid-cols-3">
        {years.map((year) => {
          const report = getYearReport(year);
          if (!report) return null;

          return (
            <Link
              key={year}
              href={yearReportHref(year)}
              className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-none transition-colors hover:border-cyan-400/20 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] tracking-[0.18em] text-zinc-500">דוח שנתי</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">{year}</h2>
                </div>
                <ArrowUpLeft className="size-4 text-cyan-300" />
              </div>
              <p className="mt-5 text-2xl font-semibold text-cyan-200">{formatCurrencyIls(report.total)}</p>
              <p className="mt-2 text-sm text-zinc-400">{report.monthCount} חודשים בדוח</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
                  יעד {formatCurrencyIls(report.budget)}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    report.variance > 0
                      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                      : "border-cyan-400/15 bg-cyan-400/10 text-cyan-200"
                  }
                >
                  {report.variance > 0 ? `חריגה ${formatCurrencyIls(Math.abs(report.variance))}` : `מרווח ${formatCurrencyIls(Math.abs(report.variance))}`}
                </Badge>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">חודשים אחרונים</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מעבר מהיר לדוחות חודשיים</h2>
            </div>
            <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
              לחיץ מכל חודש
            </Badge>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {latestMonths.map((month) => (
              <Link
                key={month.key}
                href={monthReportHref(month.key)}
                className="rounded-[24px] border border-white/8 bg-black/20 p-4 transition-colors hover:border-cyan-400/20 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{month.label}</p>
                    <p className="mt-2 text-sm text-zinc-500">{month.transactionCount} עסקאות</p>
                  </div>
                  <ArrowUpLeft className="size-4 text-cyan-300" />
                </div>
                <p className="mt-4 text-xl font-semibold text-cyan-200">{formatCurrencyIls(month.total)}</p>
                <p className="mt-2 text-sm text-zinc-400">יעד חודשי: {formatCurrencyIls(month.budget)}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <div className="flex items-center gap-3">
            <CalendarRange className="size-4 text-cyan-300" />
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">מבנה הדוחות</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">איך הניווט עובד</h2>
            </div>
          </div>
          <div className="mt-6 space-y-4 text-sm leading-6 text-zinc-400">
            <p>כל דוח שנתי אוסף את כל חודשי אותה שנה ומאפשר להיכנס מכל חודש לדוח החודשי שלו.</p>
            <p>כל דוח חודשי כולל פירוט עסקאות, ספקים מובילים, חלוקה בין חיובים חוזרים לחד-פעמיים וניווט לחודש הקודם או הבא.</p>
            <p>ככל שמופיע שם של חודש בדשבורד, אפשר לעבור ממנו ישירות למסך הדוח של אותו חודש.</p>
          </div>
        </Card>
      </section>
    </>
  );
}
