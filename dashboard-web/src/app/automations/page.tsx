import { ArrowLeft, BadgeCheck, Clock3, Workflow } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDashboardModel } from "@/lib/dashboard-data";

export default function AutomationsPage() {
  const model = getDashboardModel();

  return (
    <>
      <PageHeader
        eyebrow="אוטומציות"
        title="חוקים פעילים ובריאות התהליך"
        description="העמוד הזה הופך את הדשבורד למסך תפעול: רואים אילו חוקים קיימים, מתי הם רצים, מה יציב ואיפה עדיין צריך מגע אנושי."
        actions={<Button className="bg-cyan-400 text-black hover:bg-cyan-300">בדוק תהליך</Button>}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {model.automations.map((automation) => (
          <Card key={automation.name} className="border-white/8 bg-white/[0.03] p-6 shadow-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{automation.cadence}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{automation.name}</h2>
              </div>
              <Badge
                variant="outline"
                className={
                  automation.status === "active"
                    ? "border-cyan-400/15 bg-cyan-400/8 text-cyan-200"
                    : automation.status === "watch"
                      ? "border-amber-400/15 bg-amber-400/8 text-amber-200"
                      : "border-white/10 bg-white/[0.05] text-zinc-300"
                }
              >
                {automation.status === "active" ? "פעיל" : automation.status === "watch" ? "לבדיקה" : "חצי־אוטומטי"}
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">{automation.description}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs tracking-[0.18em] text-zinc-500">הרצה אחרונה</p>
                <p className="mt-2 text-sm text-zinc-100">{automation.lastRun}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <p className="text-xs tracking-[0.18em] text-zinc-500">הרצה הבאה</p>
                <p className="mt-2 text-sm text-zinc-100">{automation.nextRun}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500">שלבי התהליך</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">מפת התהליך הנוכחית</h2>
          <div className="mt-6 space-y-4">
            {[
              "סריקת מקורות מהמייל",
              "פענוח גוף המייל והקבצים המצורפים",
              "הזרקת כללי חיוב חוזר",
              "בנייה מחדש של חוברת האקסל",
              "ייצוא סטטי אל docs",
              "פרסום ל־GitHub Pages",
            ].map((step, index, steps) => (
              <div key={step} className="flex items-center gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="rounded-full border border-cyan-400/15 bg-cyan-400/8 p-2 text-cyan-300">
                  <BadgeCheck className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{step}</p>
                  <p className="mt-1 text-sm text-zinc-500">שלב {index + 1}</p>
                </div>
                {index < steps.length - 1 ? <ArrowLeft className="size-4 text-zinc-600" /> : null}
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
            <div className="flex items-center gap-3">
              <Clock3 className="size-4 text-zinc-300" />
              <h2 className="text-xl font-semibold text-white">מה העמוד הזה פותר</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              במקום להחביא אוטומציות בתוך סקריפטים, הממשק מתעד עכשיו את החוקים, התזמון והסטטוס התפעולי. כך הרבה יותר קל לשדרג את המערכת בהמשך.
            </p>
          </Card>

          <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
            <div className="flex items-center gap-3">
              <Workflow className="size-4 text-cyan-300" />
              <h2 className="text-xl font-semibold text-white">שכבת האוטומציה הבאה</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
              <li>חיבור דחיפה של Gmail במקום סריקות רוחביות</li>
              <li>חילוץ בעזרת AI עבור חשבוניות עם אמינות נמוכה</li>
              <li>API של ספקים לפרסום ומנויים</li>
              <li>אישורי בדיקה והיסטוריית בקרה במסד נתונים אמיתי</li>
            </ul>
          </Card>
        </div>
      </section>
    </>
  );
}
