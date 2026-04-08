"use client";

import { startTransition, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SettingsModel } from "@/lib/dashboard-data";

type SectionKey = keyof SettingsModel;

function SettingsRow({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-5 border-t border-white/6 py-5 first:border-t-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      <div>
        <p className="text-base font-medium text-zinc-100">{label}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{help}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function SettingsPageClient({ initialSettings }: { initialSettings: SettingsModel }) {
  const [settings, setSettings] = useState(() => {
    if (typeof window === "undefined") return initialSettings;

    const raw = window.localStorage.getItem("rt-ai-console-settings");
    if (!raw) return initialSettings;

    try {
      return JSON.parse(raw) as SettingsModel;
    } catch {
      window.localStorage.removeItem("rt-ai-console-settings");
      return initialSettings;
    }
  });
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);

  function saveSection(section: SectionKey) {
    startTransition(() => {
      window.localStorage.setItem("rt-ai-console-settings", JSON.stringify(settings));
      setSavedSection(section);
      window.setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 2200);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">הגדרות כלליות</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            אלו פקדים מול מפעיל שמעצבים את אופן קריאת ההוצאות, יצירת ערכים חוזרים ומסגור עבודת הסקירה.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="שער חליפין דולר"
            help="משמש לספר העבודה, מסגור התקציב וסיכום הפיננסים המוצג בכל המסוף."
          >
            <Input
              value={String(settings.finance.usdRate)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, usdRate: Number(event.target.value) || 0 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="יום חיוב ברירת מחדל"
            help="היום החלופי המשמש כאשר לכלל חוזר אין עדיין תאריך חיוב ספציפי לספק."
          >
            <Input
              value={String(settings.finance.defaultBillingDay)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, defaultBillingDay: Number(event.target.value) || 1 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="תקציב עבודה חודשי"
            help="משמש ללוח תקציב לעומת בפועל ולהדגשת חודשים שזקוקים לסקירת מפעיל."
          >
            <Input
              value={String(settings.finance.monthlyBudget)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, monthlyBudget: Number(event.target.value) || 0 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">
            הנחות חליפין וברירות מחדל לחיוב עבור כל הדשבורד.
          </p>
          <Button onClick={() => saveSection("finance")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "finance" ? <CheckCircle2 className="me-2 size-4" /> : null}
            שמור הגדרות פיננסיות
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">כללי זיהוי</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            כוונן את אופן פעולת פרסר תיבת הדואר לפני שנוסיף אוטומציה עשירה יותר וחילוץ בסיוע AI.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="חלון סריקה"
            help="כמה ימים אחורה סורק Gmail כאשר מחפש חשבוניות חסרות."
          >
            <Input
              value={String(settings.detection.scanWindowDays)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  detection: { ...settings.detection, scanWindowDays: Number(event.target.value) || 30 },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="מצב פרסר"
            help="קובע אם היבואן מוטב לדיוק, התאמה מאוזנת, או לכידה אגרסיבית יותר."
          >
            <Select
              value={settings.detection.parserMode}
              onValueChange={(value) =>
                setSettings({
                  ...settings,
                  detection: { ...settings.detection, parserMode: value },
                })
              }
            >
              <SelectTrigger className="h-11 border-white/10 bg-black/20 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">מחמיר</SelectItem>
                <SelectItem value="balanced">מאוזן</SelectItem>
                <SelectItem value="aggressive">אגרסיבי</SelectItem>
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            label="שולחים מוחרגים"
            help="תבנית שולח אחת לכל שורה. השתמש בזה לרעש שלעולם לא אמור לפתוח פריט בדיקה."
          >
            <Textarea
              value={settings.detection.ignoredSenders.join("\n")}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  detection: {
                    ...settings.detection,
                    ignoredSenders: event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="min-h-32 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">הנחות זיהוי נוכחיות עבור Gmail, טקסט PDF ופרסור גוף.</p>
          <Button onClick={() => saveSection("detection")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "detection" ? <CheckCircle2 className="me-2 size-4" /> : null}
            שמור כללי זיהוי
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">רישום ספקים</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            נהל את רשימת הספקים הידועים ואת תת-הקבוצה שעדיין מסתמכת על אישור ידני.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="ספקים ידועים"
            help="רשימה זו מפעילה את מסוף הספקים ומשמשת כקו בסיס לבדיקת חיובים חדשים נכנסים."
          >
            <Textarea
              value={settings.vendors.knownVendors.join("\n")}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  vendors: {
                    ...settings.vendors,
                    knownVendors: event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="min-h-40 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="ספקים ידניים בלבד"
            help="השתמש בזה לסימון ספקים שאמורים להישאר בתור הבדיקה עד שנחבר יבואן דטרמיניסטי."
          >
            <Textarea
              value={settings.vendors.manualOnlyVendors.join("\n")}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  vendors: {
                    ...settings.vendors,
                    manualOnlyVendors: event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  },
                })
              }
              className="min-h-32 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">סעיף זה מגדיר מה המערכת אמורה לראות כהתנהגות ספק תקינה.</p>
          <Button onClick={() => saveSection("vendors")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "vendors" ? <CheckCircle2 className="me-2 size-4" /> : null}
            שמור רישום ספקים
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">כללי חיוב חוזר</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            פקדים אלו מעצבים את שכבת החיוב החוזר שממלאת חיובים חודשיים צפויים לפני שתיבת הדואר קולטת אותם.
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          {[
            {
              checked: settings.recurringRules.openAiEnabled,
              title: "הזרק חיוב חוזר של OpenAI ב-16 לחודש",
              description: "מבטיח ש-ChatGPT Plus גלוי בכל חודש גם לפני הגעת ייבוא החשבונית.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, openAiEnabled: checked },
                }),
            },
            {
              checked: settings.recurringRules.rebuildDashboardOnChange,
              title: "בנה מחדש את הדשבורד כשהדוח משתנה",
              description: "מבטיח שהמסוף הסטטי וספר Excel נגזרים מאותו מקור אמת.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, rebuildDashboardOnChange: checked },
                }),
            },
            {
              checked: settings.recurringRules.autopublishEnabled,
              title: "סמן פרסום דשבורד כחלק מתהליך העבודה",
              description: "שומר על ייצוא GitHub Pages כשלב ראשי במסוף המפעיל.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, autopublishEnabled: checked },
                }),
            },
          ].map((item) => (
            <label key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-4">
              <Checkbox checked={item.checked} onCheckedChange={(checked) => item.update(checked === true)} />
              <div>
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">כללי החיוב החוזר הם מה שגורם למסוף להרגיש כמערכת תפעולית, לא רק דוח.</p>
          <Button onClick={() => saveSection("recurringRules")} className="bg-emerald-500 text-black hover:bg-emerald-400">
            {savedSection === "recurringRules" ? <CheckCircle2 className="me-2 size-4" /> : null}
            שמור כללי חיוב חוזר
          </Button>
        </div>
      </Card>
    </div>
  );
}
