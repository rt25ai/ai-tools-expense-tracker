"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, LoaderCircle, PlugZap, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { monthReportHref } from "@/lib/report-links";
import { formatDateLabel } from "@/lib/formatters";
import { parseManualReceiptPdf, type ManualReceiptParseResult } from "@/lib/manual-receipt-parser";
import type { ManualReceiptRecord } from "@/lib/manual-receipts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const LOCAL_BRIDGE_URL = "http://127.0.0.1:8765";

type ConnectionStatus = "checking" | "online" | "offline" | "not-configured";

type ReceiptFormState = {
  tool: string;
  date: string;
  description: string;
  currency: "USD" | "ILS";
  originalAmount: string;
  notes: string;
};

type RuntimeImportConfig = {
  gatewayUrl: string | null;
  mode: "gateway" | "local-fallback";
};

const initialFormState: ReceiptFormState = {
  tool: "",
  date: "",
  description: "",
  currency: "USD",
  originalAmount: "",
  notes: "",
};

const defaultImportConfig: RuntimeImportConfig = {
  gatewayUrl: null,
  mode: "local-fallback",
};

function formatOriginalAmount(amount: number, currency: "USD" | "ILS") {
  return new Intl.NumberFormat(currency === "ILS" ? "he-IL" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function getBasePath() {
  if (typeof window === "undefined") {
    return "";
  }

  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] === "ai-tools-expense-tracker") {
    return "/ai-tools-expense-tracker";
  }

  return "";
}

function assetUrl(relativePath: string) {
  const cleaned = relativePath.replace(/^\/+/, "");
  return `${getBasePath()}/${cleaned}`.replace(/\/{2,}/g, "/");
}

async function loadRuntimeImportConfig(): Promise<RuntimeImportConfig> {
  try {
    const response = await fetch(assetUrl("manual-import-config.json"), { cache: "no-store" });
    if (!response.ok) {
      return defaultImportConfig;
    }

    const payload = (await response.json()) as Partial<RuntimeImportConfig>;
    return {
      gatewayUrl: payload.gatewayUrl?.trim() || null,
      mode: payload.mode === "gateway" ? "gateway" : "local-fallback",
    };
  } catch {
    return defaultImportConfig;
  }
}

function statusBadgeClasses(status: ConnectionStatus) {
  if (status === "online") {
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  }
  if (status === "checking") {
    return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  }
  return "border-rose-400/20 bg-rose-400/10 text-rose-200";
}

export function ManualReceiptImportClient({
  knownVendors,
  initialReceipts,
}: {
  knownVendors: string[];
  initialReceipts: ManualReceiptRecord[];
}) {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeImportConfig>(defaultImportConfig);
  const [gatewayStatus, setGatewayStatus] = useState<ConnectionStatus>("checking");
  const [gatewayMessage, setGatewayMessage] = useState("בודק אם שער הייבוא המאובטח זמין...");
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>("checking");
  const [bridgeMessage, setBridgeMessage] = useState("בודק אם הגשר המקומי פעיל...");
  const [form, setForm] = useState<ReceiptFormState>(initialFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ManualReceiptParseResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recentReceipts, setRecentReceipts] = useState(initialReceipts);

  const monthHref = useMemo(() => {
    return form.date ? monthReportHref(monthKeyFromDate(form.date)) : null;
  }, [form.date]);

  const checkGatewayForConfig = useCallback(async (config: RuntimeImportConfig): Promise<ConnectionStatus> => {
    if (!config.gatewayUrl) {
      setGatewayStatus("not-configured");
      setGatewayMessage("שער ייבוא מאובטח עדיין לא הוגדר. כרגע אפשר לעבוד דרך הגשר המקומי בלבד.");
      return "not-configured";
    }

    setGatewayStatus("checking");
    try {
      const response = await fetch(`${config.gatewayUrl.replace(/\/$/, "")}/api/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Secure gateway is not responding.");
      }

      const payload = (await response.json()) as { ok?: boolean; target?: string };
      if (!payload.ok) {
        throw new Error("Secure gateway is not healthy.");
      }

      setGatewayStatus("online");
      setGatewayMessage(`השער המאובטח פעיל ומוכן לשמירה אונליין ל־${payload.target ?? "GitHub"}.`);
      return "online";
    } catch {
      setGatewayStatus("offline");
      setGatewayMessage("השער המאובטח לא ענה כרגע. אם הוא אמור לעבוד, כדאי לבדוק את הפריסה או את ה־CORS.");
      return "offline";
    }
  }, []);

  const checkGateway = useCallback(async () => {
    await checkGatewayForConfig(runtimeConfig);
  }, [runtimeConfig, checkGatewayForConfig]);

  const checkBridge = useCallback(async () => {
    try {
      const response = await fetch(`${LOCAL_BRIDGE_URL}/health`);
      if (!response.ok) {
        throw new Error("Local bridge is not responding.");
      }

      const payload = (await response.json()) as { receiptsCount?: number };
      setBridgeStatus("online");
      setBridgeMessage(`הגשר המקומי פעיל. כרגע שמורות ${payload.receiptsCount ?? 0} קבלות ידניות.`);
    } catch {
      setBridgeStatus("offline");
      setBridgeMessage("הגשר המקומי לא פעיל. זה בסדר אם עובדים דרך השער המאובטח, אבל לא מספיק לשמירה מקומית.");
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrap() {
      const loadedConfig = await loadRuntimeImportConfig();
      if (isCancelled) {
        return;
      }

      setRuntimeConfig(loadedConfig);
      await Promise.all([checkGatewayForConfig(loadedConfig), checkBridge()]);
    }

    void bootstrap();
    return () => {
      isCancelled = true;
    };
  }, [checkBridge, checkGatewayForConfig]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void checkGateway();
      void checkBridge();
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [checkBridge, checkGateway]);

  async function handleParsePdf() {
    if (!selectedFile) {
      setSaveError("בחר קודם קובץ PDF לחילוץ.");
      return;
    }

    setIsParsingPdf(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = await parseManualReceiptPdf(selectedFile);
      setParseResult(payload);
      setForm((current) => ({
        ...current,
        tool: current.tool || payload.suggestedTool || current.tool,
        date: current.date || payload.suggestedDate || current.date,
        description: current.description || payload.suggestedDescription || current.description,
        currency: payload.suggestedCurrency || current.currency,
        originalAmount:
          current.originalAmount || payload.suggestedAmount === null
            ? current.originalAmount
            : String(payload.suggestedAmount),
      }));
      setSaveMessage("ה־PDF נותח בדפדפן והטופס מולא אוטומטית ככל האפשר. אפשר לעבור על השדות ואז לשמור.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "חילוץ ה־PDF נכשל.");
    } finally {
      setIsParsingPdf(false);
    }
  }

  async function saveViaGateway(): Promise<{ entry: ManualReceiptRecord; commit: string }> {
    if (!runtimeConfig.gatewayUrl) {
      throw new Error("שער הייבוא המאובטח לא מוגדר.");
    }

    const fileBase64 = selectedFile ? await readFileAsDataUrl(selectedFile) : null;
    const response = await fetch(`${runtimeConfig.gatewayUrl.replace(/\/$/, "")}/api/manual-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entry: {
          tool: form.tool,
          date: form.date,
          description: form.description,
          currency: form.currency,
          original_amount: Number(form.originalAmount),
          notes: form.notes,
          entry_mode: selectedFile ? "pdf-upload" : "manual-form",
        },
        fileName: selectedFile?.name ?? null,
        fileBase64,
      }),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      commit?: string;
      entry?: ManualReceiptRecord;
    };

    if (!response.ok || !payload.ok || !payload.entry || !payload.commit) {
      throw new Error(payload.error || "Could not save the receipt through the secure gateway.");
    }

    return {
      entry: payload.entry,
      commit: payload.commit,
    };
  }

  async function saveViaBridge(): Promise<{ entry: ManualReceiptRecord; commit: string }> {
    const fileBase64 = selectedFile ? await readFileAsDataUrl(selectedFile) : null;
    const response = await fetch(`${LOCAL_BRIDGE_URL}/manual-receipts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry: {
          tool: form.tool,
          date: form.date,
          description: form.description,
          currency: form.currency,
          original_amount: Number(form.originalAmount),
          notes: form.notes,
          entry_mode: selectedFile ? "pdf-upload" : "manual-form",
        },
        fileName: selectedFile?.name ?? null,
        fileBase64,
      }),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      commit?: string;
      entry?: ManualReceiptRecord;
    };

    if (!response.ok || !payload.ok || !payload.entry || !payload.commit) {
      throw new Error(payload.error || "Could not save the receipt through the local bridge.");
    }

    return {
      entry: payload.entry,
      commit: payload.commit,
    };
  }

  async function handleSave() {
    if (!form.tool || !form.date || !form.description || !form.originalAmount) {
      setSaveError("יש למלא ספק, תאריך, תיאור וסכום לפני שמירה.");
      return;
    }

    if (gatewayStatus !== "online" && bridgeStatus !== "online") {
      setSaveError("אין כרגע נתיב שמירה זמין. צריך שער מאובטח פעיל או גשר מקומי פעיל.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = gatewayStatus === "online" ? await saveViaGateway() : await saveViaBridge();

      startTransition(() => {
        setRecentReceipts((current) => [payload.entry, ...current].slice(0, 8));
        setForm(initialFormState);
        setSelectedFile(null);
        setParseResult(null);
        setSaveMessage(
          gatewayStatus === "online"
            ? `הקבלה נשמרה דרך השער המאובטח בקומיט ${payload.commit}. GitHub Actions יבנה עכשיו מחדש את האקסל והדשבורד.`
            : `הקבלה נשמרה דרך הגשר המקומי בקומיט ${payload.commit}.`,
        );
      });

      await Promise.all([checkGateway(), checkBridge()]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "שמירת הקבלה נכשלה.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.18em] text-zinc-500">Secure Import</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">שער ייבוא מאובטח</h2>
            </div>
            <Badge variant="outline" className={statusBadgeClasses(gatewayStatus)}>
              {gatewayStatus === "online"
                ? "פעיל"
                : gatewayStatus === "checking"
                  ? "בודק"
                  : gatewayStatus === "not-configured"
                    ? "לא הוגדר"
                    : "לא זמין"}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{gatewayMessage}</p>
          <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
            <p className="font-medium text-zinc-100">הכיוון המומלץ לטווח ארוך</p>
            <p className="mt-2">
              הדשבורד שולח את הנתונים לשרת מאובטח שמחזיק את הסודות בצד שרת, מעדכן את GitHub, ואז GitHub Actions בונה
              מחדש את האקסל ואת האתר.
            </p>
          </div>
          <Button
            variant="outline"
            className="mt-5 border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]"
            onClick={() => void checkGateway()}
          >
            <RefreshCw className="size-4" />
            בדוק שער מאובטח
          </Button>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.18em] text-zinc-500">Local Fallback</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">גשר מקומי</h2>
            </div>
            <Badge variant="outline" className={statusBadgeClasses(bridgeStatus)}>
              {bridgeStatus === "online" ? "פעיל" : bridgeStatus === "checking" ? "בודק" : "לא זמין"}
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{bridgeMessage}</p>
          <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-zinc-400">
            <p className="font-medium text-zinc-100">אם עדיין אין שער מאובטח</p>
            <code className="mt-2 block text-cyan-200">python manual_receipt_bridge.py</code>
          </div>
          <Button
            variant="outline"
            className="mt-5 border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]"
            onClick={() => void checkBridge()}
          >
            <RefreshCw className="size-4" />
            בדוק גשר מקומי
          </Button>
        </Card>

        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.18em] text-zinc-500">Sync</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">מה מתעדכן אחרי השמירה</h2>
            </div>
            <PlugZap className="size-5 text-cyan-300" />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              "manual_receipts.json נשמר כמקור אמת קבוע לכל הייבוא הידני.",
              "קובץ ה־Excel נבנה מחדש עם החיוב בחודש הרלוונטי.",
              "הדשבורד הסטטי מתעדכן עם אותם נתונים בדיוק.",
              "במצב אונליין, הכול נבנה מחדש ב־GitHub Actions בלי שהמחשב שלך צריך להיות פתוח.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-zinc-400">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <Tabs defaultValue="manual" className="gap-6">
          <div className="flex flex-col gap-4 border-b border-white/6 pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-zinc-500">ייבוא חדש</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">הוסף קבלה שלא הגיעה למייל</h2>
            </div>
            <TabsList variant="line" className="bg-transparent p-0">
              <TabsTrigger value="manual" className="data-active:text-white">
                הזנת נתונים
              </TabsTrigger>
              <TabsTrigger value="pdf" className="data-active:text-white">
                העלאת PDF
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="manual" className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100">ספק</label>
                <Input
                  list="known-vendors"
                  value={form.tool}
                  onChange={(event) => setForm((current) => ({ ...current, tool: event.target.value }))}
                  placeholder="למשל Dzine"
                  className="h-11 border-white/10 bg-black/20 text-zinc-100"
                />
                <datalist id="known-vendors">
                  {knownVendors.map((vendor) => (
                    <option key={vendor} value={vendor} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100">תאריך קבלה</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  className="h-11 border-white/10 bg-black/20 text-zinc-100"
                />
                {monthHref ? (
                  <Link className="text-sm text-cyan-300 transition-colors hover:text-cyan-200" href={monthHref}>
                    הדוח שיתעדכן: {monthKeyFromDate(form.date)}
                  </Link>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100">מטבע</label>
                <Select
                  value={form.currency}
                  onValueChange={(value: "USD" | "ILS") =>
                    setForm((current) => ({ ...current, currency: value }))
                  }
                >
                  <SelectTrigger className="h-11 border-white/10 bg-black/20 text-zinc-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ILS">ILS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-100">סכום מקורי</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.originalAmount}
                  onChange={(event) => setForm((current) => ({ ...current, originalAmount: event.target.value }))}
                  placeholder="0.00"
                  className="h-11 border-white/10 bg-black/20 text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100">תיאור החיוב</label>
              <Input
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="למשל Dzine Video Top-Up 1"
                className="h-11 border-white/10 bg-black/20 text-zinc-100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-100">הערות</label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="כאן אפשר לציין שהקבלה נמשכה ידנית מאזור החשבון או כל הערה אחרת."
                className="min-h-28 border-white/10 bg-black/20 text-zinc-100"
              />
            </div>
          </TabsContent>

          <TabsContent value="pdf" className="space-y-6">
            <div className="rounded-[26px] border border-dashed border-cyan-400/20 bg-cyan-400/[0.04] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-medium text-white">העלה קבלת PDF</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    החילוץ מתבצע ישירות בדפדפן. אחרי החילוץ אפשר לעבור על השדות, לתקן אם צריך, ואז לשמור דרך השער
                    המאובטח או דרך הגשר המקומי.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 hover:bg-white/[0.06]">
                  <Upload className="size-4" />
                  בחר PDF
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {selectedFile ? (
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                  קובץ נבחר: {selectedFile.name}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() => void handleParsePdf()}
                  disabled={!selectedFile || isParsingPdf}
                  className="bg-cyan-400 text-black hover:bg-cyan-300"
                >
                  {isParsingPdf ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                  חלץ נתונים מה־PDF
                </Button>
                <p className="self-center text-sm text-zinc-500">
                  אחרי החילוץ, השדות בטופס יתמלאו אוטומטית ככל האפשר.
                </p>
              </div>
            </div>

            {parseResult ? (
              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <Card className="border-white/8 bg-black/20 p-5 shadow-none">
                  <p className="text-sm font-medium text-white">מה זוהה מתוך הקובץ</p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-400">
                    <p>
                      ספק: <span className="text-zinc-100">{parseResult.suggestedTool ?? "לא זוהה"}</span>
                    </p>
                    <p>
                      שירות:{" "}
                      <span className="text-zinc-100">{parseResult.suggestedDescription ?? "לא זוהה"}</span>
                    </p>
                    <p>
                      תאריך: <span className="text-zinc-100">{parseResult.suggestedDate ?? "לא זוהה"}</span>
                    </p>
                    <p>
                      מטבע: <span className="text-zinc-100">{parseResult.suggestedCurrency ?? "לא זוהה"}</span>
                    </p>
                    <p>
                      סכום: <span className="text-zinc-100">{parseResult.suggestedAmount ?? "לא זוהה"}</span>
                    </p>
                  </div>
                </Card>
                <Card className="border-white/8 bg-black/20 p-5 shadow-none">
                  <p className="text-sm font-medium text-white">תצוגה מקדימה של הטקסט</p>
                  <pre className="mt-4 max-h-[280px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                    {parseResult.textPreview || "לא נמצא טקסט קריא בקובץ."}
                  </pre>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

        {(saveMessage || saveError) ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              saveError
                ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"
            }`}
          >
            {saveError ?? saveMessage}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 pt-6">
          <div className="text-sm text-zinc-500">
            <p>השמירה משתמשת קודם בשער המאובטח, ואם הוא לא זמין עוברת לגשר המקומי.</p>
            <p className="mt-1">
              הכיוון הנכון לטווח ארוך הוא שער מאובטח, כדי שתוכל להעלות מסמכים גם מהנייד בלי תלות במחשב פתוח.
            </p>
          </div>
          <Button onClick={() => void handleSave()} disabled={isSaving} className="bg-cyan-400 text-black hover:bg-cyan-300">
            {isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            שמור, בנה מחדש ופרסם
          </Button>
        </div>
      </Card>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6">
          <div>
            <p className="text-[11px] tracking-[0.18em] text-zinc-500">קבלות ידניות</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">הייבואים הידניים האחרונים</h2>
          </div>
          <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
            {recentReceipts.length} פריטים
          </Badge>
        </div>

        <div className="mt-6 space-y-3">
          {recentReceipts.length ? (
            recentReceipts.map((receipt) => (
              <div key={receipt.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-white">{receipt.tool}</p>
                    <p className="mt-1 text-sm text-zinc-400">{receipt.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-cyan-200">
                      {formatOriginalAmount(receipt.original_amount, receipt.currency)}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{formatDateLabel(receipt.date)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
                    {receipt.entry_mode === "pdf-upload" ? "PDF" : "ידני"}
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">
                    {receipt.currency}
                  </Badge>
                  <Link
                    href={monthReportHref(monthKeyFromDate(receipt.date))}
                    className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 transition-colors hover:bg-cyan-400/15"
                  >
                    לדוח {monthKeyFromDate(receipt.date)}
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-zinc-400">
              עדיין לא נשמרו קבלות ידניות. ברגע שתוסיף אחת, היא תופיע כאן יחד עם הסנכרון לאקסל ולדוחות.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
