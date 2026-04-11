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
import {
  DASHBOARD_SETTINGS_STORAGE_KEY,
  DEFAULT_MONTHLY_BUDGET,
  sanitizeMonthlyBudget,
} from "@/lib/monthly-budget";
import { dispatchSettingsUpdated } from "@/lib/use-monthly-budget";

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

    const raw = window.localStorage.getItem(DASHBOARD_SETTINGS_STORAGE_KEY);
    if (!raw) return initialSettings;

    try {
      const parsed = JSON.parse(raw) as Partial<SettingsModel>;
      return {
        finance: {
          ...initialSettings.finance,
          ...parsed.finance,
          monthlyBudget: sanitizeMonthlyBudget(
            parsed.finance?.monthlyBudget,
            initialSettings.finance.monthlyBudget,
          ),
        },
        detection: {
          ...initialSettings.detection,
          ...parsed.detection,
        },
        vendors: {
          ...initialSettings.vendors,
          ...parsed.vendors,
        },
        recurringRules: {
          ...initialSettings.recurringRules,
          ...parsed.recurringRules,
        },
      };
    } catch {
      window.localStorage.removeItem(DASHBOARD_SETTINGS_STORAGE_KEY);
      return initialSettings;
    }
  });
  const [savedSection, setSavedSection] = useState<SectionKey | null>(null);

  function normalizeSettingsForStorage(nextSettings: SettingsModel) {
    return {
      ...nextSettings,
      finance: {
        ...nextSettings.finance,
        monthlyBudget: sanitizeMonthlyBudget(
          nextSettings.finance.monthlyBudget,
          DEFAULT_MONTHLY_BUDGET,
        ),
      },
    } satisfies SettingsModel;
  }

  function markSectionSaved(section: SectionKey) {
    setSavedSection(section);
    window.setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 2200);
  }

  function saveSection(section: SectionKey, nextSettings = settings) {
    startTransition(() => {
      const settingsToSave = normalizeSettingsForStorage(nextSettings);

      setSettings(settingsToSave);
      window.localStorage.setItem(DASHBOARD_SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
      dispatchSettingsUpdated();
      markSectionSaved(section);
    });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">הגדרות כלליות</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            אלה בקרות תפעול שמכתיבות איך המערכת קוראת הוצאות, יוצרת חיובים חוזרים ומסגרת את עבודת הבדיקה.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="שער דולר"
            help="השער הרשמי נמשך אוטומטית ממקור רשמי בכל בנייה, וכל הסכומים בממשק מוצגים בשקלים לפי השער העדכני."
          >
            <Input
              value={String(settings.finance.usdRate)}
              readOnly
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
            <p className="mt-3 text-sm text-zinc-500">
              {settings.finance.exchangeRateSource ?? "Bank of Israel Public API"}
              {settings.finance.exchangeRateUpdatedAt ? ` | עודכן: ${settings.finance.exchangeRateUpdatedAt}` : ""}
            </p>
          </SettingsRow>
          <SettingsRow
            label="יום חיוב ברירת מחדל"
            help="היום שישמש כברירת מחדל כשעוד לא הוגדר יום חיוב ייעודי לספק."
          >
            <Input
              value={String(settings.finance.defaultBillingDay)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: { ...settings.finance, defaultBillingDay: Number(event.target.value) || 1 },
                })
              }
              onBlur={(event) =>
                saveSection("finance", {
                  ...settings,
                  finance: {
                    ...settings.finance,
                    defaultBillingDay: Number(event.currentTarget.value) || 1,
                  },
                })
              }
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
          <SettingsRow
            label="תקציב עבודה חודשי"
            help="משמש למסך תקציב מול בפועל ולסימון חודשים שדורשים בדיקה."
          >
            <Input
              value={String(settings.finance.monthlyBudget)}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  finance: {
                    ...settings.finance,
                    monthlyBudget: Number(event.target.value) || 0,
                  },
                })
              }
              onBlur={(event) =>
                saveSection("finance", {
                  ...settings,
                  finance: {
                    ...settings.finance,
                    monthlyBudget: Number(event.currentTarget.value) || 0,
                  },
                })
              }
              type="number"
              min={1}
              step="0.01"
              className="h-11 border-white/10 bg-black/20 text-zinc-100"
            />
          </SettingsRow>
        </div>
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4">
          <p className="text-sm text-zinc-500">
            הנחות שער מטבע וברירות מחדל לחיוב עבור כל המערכת.
          </p>
          <Button onClick={() => saveSection("finance")} className="bg-cyan-400 text-black hover:bg-cyan-300">
            {savedSection === "finance" ? <CheckCircle2 className="ml-2 size-4" /> : null}
            שמור הגדרות כספיות
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">כללי זיהוי</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            כוונון האופן שבו מפענח המיילים פועל לפני שמוסיפים שכבת אוטומציה וניתוח AI רחבה יותר.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="חלון סריקה"
            help="כמה ימים אחורה סורק Gmail יבדוק כשהוא מחפש חשבוניות חסרות."
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
            label="מצב מפענח"
            help="קובע אם היבוא יתעדף דיוק, איזון או לכידה אגרסיבית יותר."
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
            label="שולחים להתעלמות"
            help="תבנית שולח אחת בכל שורה. מיועד לרעש שלא אמור לפתוח לעולם פריט לבדיקה."
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
          <p className="text-sm text-zinc-500">הנחות הזיהוי הנוכחיות עבור Gmail, טקסט מתוך PDF ופענוח גוף המייל.</p>
          <Button onClick={() => saveSection("detection")} className="bg-cyan-400 text-black hover:bg-cyan-300">
            {savedSection === "detection" ? <CheckCircle2 className="ml-2 size-4" /> : null}
            שמור כללי זיהוי
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">רישום ספקים</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            ניהול רשימת הספקים המוכרים ותת־הקבוצה שעדיין נשענת על אישור ידני.
          </p>
        </div>
        <div className="px-6 py-2">
          <SettingsRow
            label="ספקים מוכרים"
            help="הרשימה הזו מזינה את מסך הספקים ומשמשת בסיס בדיקה לחיובים חדשים."
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
            help="סמן כאן ספקים שצריכים להישאר בזרימת הבדיקה עד שנחבר להם יבוא אמין."
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
          <p className="text-sm text-zinc-500">החלק הזה מגדיר מה המערכת צריכה לראות כהתנהגות ספק תקינה.</p>
          <Button onClick={() => saveSection("vendors")} className="bg-cyan-400 text-black hover:bg-cyan-300">
            {savedSection === "vendors" ? <CheckCircle2 className="ml-2 size-4" /> : null}
            שמור רישום ספקים
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-none">
        <div className="border-b border-white/6 px-6 py-5">
          <h2 className="text-2xl font-semibold text-white">כללים חוזרים</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            ההגדרות כאן קובעות איך שכבת החיובים החוזרים ממלאת הוצאות צפויות עוד לפני שהחשבונית מגיעה מהמייל.
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          {[
            {
              checked: settings.recurringRules.openAiEnabled,
              title: "להוסיף חיוב OpenAI קבוע ב־16 לחודש",
              description: "שומר את ChatGPT Plus גלוי בכל חודש עוד לפני שהחשבונית נקלטת.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, openAiEnabled: checked },
                }),
            },
            {
              checked: settings.recurringRules.rebuildDashboardOnChange,
              title: "לבנות מחדש את הדשבורד כשיש שינוי בדוח",
              description: "שומר על התאמה בין הדשבורד הסטטי לבין חוברת האקסל מאותו מקור אמת.",
              update: (checked: boolean) =>
                setSettings({
                  ...settings,
                  recurringRules: { ...settings.recurringRules, rebuildDashboardOnChange: checked },
                }),
            },
            {
              checked: settings.recurringRules.autopublishEnabled,
              title: "להתייחס לפרסום הדשבורד כחלק מהתהליך",
              description: "משאיר את ייצוא GitHub Pages כשלב תפעולי גלוי וברור.",
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
          <p className="text-sm text-zinc-500">הכללים החוזרים הם מה שהופך את זה למערכת תפעול, לא רק לדוח.</p>
          <Button onClick={() => saveSection("recurringRules")} className="bg-cyan-400 text-black hover:bg-cyan-300">
            {savedSection === "recurringRules" ? <CheckCircle2 className="ml-2 size-4" /> : null}
            שמור כללים חוזרים
          </Button>
        </div>
      </Card>
    </div>
  );
}
