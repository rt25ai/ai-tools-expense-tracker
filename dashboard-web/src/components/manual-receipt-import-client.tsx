"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, LoaderCircle, PencilLine, PlugZap, RefreshCw, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { formatDateLabel } from "@/lib/formatters";
import { parseManualReceiptPdf, type ManualReceiptParseResult } from "@/lib/manual-receipt-parser";
import type { ManualReceiptRecord } from "@/lib/manual-receipts";
import { monthReportHref } from "@/lib/report-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const LOCAL_BRIDGE_URL = "http://127.0.0.1:8765";
type ConnectionStatus = "checking" | "online" | "offline" | "not-configured";
type ReceiptAction = "created" | "updated" | "deleted";
type RuntimeImportConfig = { gatewayUrl: string | null; mode: "gateway" | "local-fallback" };
type ReceiptFormState = {
  tool: string;
  date: string;
  description: string;
  currency: "USD" | "ILS";
  originalAmount: string;
  notes: string;
};
type MutationPayload = {
  ok?: boolean;
  action?: ReceiptAction;
  error?: string;
  commit?: string;
  entry?: ManualReceiptRecord;
};
type MutationResult = {
  action: ReceiptAction;
  commit: string;
  entry: ManualReceiptRecord;
  channel: "gateway" | "bridge";
};

const initialFormState: ReceiptFormState = { tool: "", date: "", description: "", currency: "USD", originalAmount: "", notes: "" };
const defaultImportConfig: RuntimeImportConfig = { gatewayUrl: null, mode: "local-fallback" };

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function sortReceipts(receipts: ManualReceiptRecord[]) {
  return [...receipts].sort((a, b) => `${b.date}-${b.created_at ?? ""}-${b.id}`.localeCompare(`${a.date}-${a.created_at ?? ""}-${a.id}`));
}

function formatOriginalAmount(amount: number, currency: "USD" | "ILS") {
  return new Intl.NumberFormat(currency === "ILS" ? "he-IL" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

function getBasePath() {
  if (typeof window === "undefined") return "";
  return window.location.pathname.split("/").filter(Boolean)[0] === "ai-tools-expense-tracker" ? "/ai-tools-expense-tracker" : "";
}

function assetUrl(relativePath: string) {
  return `${getBasePath()}/${relativePath.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
}

async function loadRuntimeImportConfig(): Promise<RuntimeImportConfig> {
  try {
    const response = await fetch(assetUrl("manual-import-config.json"), { cache: "no-store" });
    if (!response.ok) return defaultImportConfig;
    const payload = (await response.json()) as Partial<RuntimeImportConfig>;
    return { gatewayUrl: payload.gatewayUrl?.trim() || null, mode: payload.mode === "gateway" ? "gateway" : "local-fallback" };
  } catch {
    return defaultImportConfig;
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function statusBadgeClasses(status: ConnectionStatus) {
  if (status === "online") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (status === "checking") return "border-amber-400/20 bg-amber-400/10 text-amber-200";
  return "border-rose-400/20 bg-rose-400/10 text-rose-200";
}

function mutationMessage(action: ReceiptAction, commit: string, channel: "gateway" | "bridge") {
  if (commit === "no-change") return "לא זוהה שינוי לשמירה.";
  const verb = action === "created" ? "נשמרה" : action === "updated" ? "עודכנה" : "נמחקה";
  return channel === "gateway"
    ? `הקבלה ${verb} דרך השער המאובטח בקומיט ${commit}. GitHub Actions יבנה עכשיו מחדש את האקסל והדשבורד.`
    : `הקבלה ${verb} דרך הגשר המקומי בקומיט ${commit}.`;
}

export function ManualReceiptImportClient({ knownVendors, initialReceipts }: { knownVendors: string[]; initialReceipts: ManualReceiptRecord[] }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeImportConfig>(defaultImportConfig);
  const [gatewayStatus, setGatewayStatus] = useState<ConnectionStatus>("checking");
  const [gatewayMessage, setGatewayMessage] = useState("בודק אם שער הייבוא המאובטח זמין...");
  const [bridgeStatus, setBridgeStatus] = useState<ConnectionStatus>("checking");
  const [bridgeMessage, setBridgeMessage] = useState("בודק אם הגשר המקומי פעיל...");
  const [activeTab, setActiveTab] = useState<"manual" | "pdf">("manual");
  const [form, setForm] = useState<ReceiptFormState>(initialFormState);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ManualReceiptParseResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(null);
  const [manualReceipts, setManualReceipts] = useState(() => sortReceipts(initialReceipts));

  const editingReceipt = editingReceiptId ? manualReceipts.find((receipt) => receipt.id === editingReceiptId) ?? null : null;
  const monthHref = useMemo(() => (form.date ? monthReportHref(monthKeyFromDate(form.date)) : null), [form.date]);

  const checkGatewayForConfig = useCallback(async (config: RuntimeImportConfig) => {
    if (!config.gatewayUrl) {
      setGatewayStatus("not-configured");
      setGatewayMessage("שער הייבוא המאובטח עדיין לא הוגדר. כרגע אפשר לעבוד דרך הגשר המקומי בלבד.");
      return;
    }
    setGatewayStatus("checking");
    try {
      const response = await fetch(`${config.gatewayUrl.replace(/\/$/, "")}/api/health`, { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; target?: string };
      if (!response.ok || !payload.ok) throw new Error();
      setGatewayStatus("online");
      setGatewayMessage(`השער המאובטח פעיל ומוכן לשמירה אונליין ל־${payload.target ?? "GitHub"}.`);
    } catch {
      setGatewayStatus("offline");
      setGatewayMessage("השער המאובטח לא ענה כרגע. אם הוא אמור לעבוד, כדאי לבדוק את הפריסה או את ה־CORS.");
    }
  }, []);

  const checkGateway = useCallback(async () => {
    await checkGatewayForConfig(runtimeConfig);
  }, [runtimeConfig, checkGatewayForConfig]);

  const checkBridge = useCallback(async () => {
    try {
      const response = await fetch(`${LOCAL_BRIDGE_URL}/health`);
      const payload = (await response.json()) as { receiptsCount?: number };
      if (!response.ok) throw new Error();
      setBridgeStatus("online");
      setBridgeMessage(`הגשר המקומי פעיל. כרגע שמורות ${payload.receiptsCount ?? 0} קבלות ידניות.`);
    } catch {
      setBridgeStatus("offline");
      setBridgeMessage("הגשר המקומי לא פעיל. זה בסדר אם עובדים דרך השער המאובטח, אבל לא מספיק לשמירה מקומית.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const loadedConfig = await loadRuntimeImportConfig();
      if (cancelled) return;
      setRuntimeConfig(loadedConfig);
      await Promise.all([checkGatewayForConfig(loadedConfig), checkBridge()]);
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [checkBridge, checkGatewayForConfig]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void checkGateway();
      void checkBridge();
    }, 20000);
    return () => window.clearInterval(intervalId);
  }, [checkBridge, checkGateway]);

  function resetEditor() {
    setEditingReceiptId(null);
    setForm(initialFormState);
    setSelectedFile(null);
    setParseResult(null);
    setActiveTab("manual");
  }

  function buildEntry() {
    return {
      tool: form.tool,
      date: form.date,
      description: form.description,
      currency: form.currency,
      original_amount: Number(form.originalAmount),
      notes: form.notes,
      entry_mode: selectedFile ? "pdf-upload" : editingReceipt?.entry_mode || "manual-form",
    };
  }

  async function requestMutation(url: string, method: "POST" | "PUT" | "DELETE", body: Record<string, unknown>, channel: "gateway" | "bridge", fallback: string): Promise<MutationResult> {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = (await response.json()) as MutationPayload;
    if (!response.ok || !payload.ok || !payload.action || !payload.commit || !payload.entry) throw new Error(payload.error || fallback);
    return { action: payload.action, commit: payload.commit, entry: payload.entry, channel };
  }

  async function saveMutation(method: "POST" | "PUT") {
    const fileBase64 = selectedFile ? await readFileAsDataUrl(selectedFile) : null;
    const body = { id: editingReceiptId, entry: buildEntry(), fileName: selectedFile?.name ?? null, fileBase64 };
    if (gatewayStatus === "online") {
      if (!runtimeConfig.gatewayUrl) throw new Error("שער הייבוא המאובטח לא מוגדר.");
      return requestMutation(`${runtimeConfig.gatewayUrl.replace(/\/$/, "")}/api/manual-import`, method, body, "gateway", "Secure gateway mutation failed.");
    }
    return requestMutation(`${LOCAL_BRIDGE_URL}/manual-receipts`, method, body, "bridge", "Local bridge mutation failed.");
  }

  async function deleteMutation(id: string) {
    const body = { id };
    if (gatewayStatus === "online") {
      if (!runtimeConfig.gatewayUrl) throw new Error("שער הייבוא המאובטח לא מוגדר.");
      return requestMutation(`${runtimeConfig.gatewayUrl.replace(/\/$/, "")}/api/manual-import`, "DELETE", body, "gateway", "Secure gateway delete failed.");
    }
    return requestMutation(`${LOCAL_BRIDGE_URL}/manual-receipts`, "DELETE", body, "bridge", "Local bridge delete failed.");
  }

  async function handleParsePdf() {
    if (!selectedFile) return setSaveError("בחר קודם קובץ PDF לחילוץ.");
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
        originalAmount: current.originalAmount || payload.suggestedAmount === null ? current.originalAmount : String(payload.suggestedAmount),
      }));
      setSaveMessage("ה־PDF נותח והטופס מולא אוטומטית ככל האפשר. אפשר לעבור על השדות ואז לשמור.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "חילוץ ה־PDF נכשל.");
    } finally {
      setIsParsingPdf(false);
    }
  }

  function handleEdit(receipt: ManualReceiptRecord) {
    setEditingReceiptId(receipt.id);
    setForm({ tool: receipt.tool, date: receipt.date, description: receipt.description, currency: receipt.currency, originalAmount: String(receipt.original_amount), notes: receipt.notes ?? "" });
    setSelectedFile(null);
    setParseResult(null);
    setSaveError(null);
    setSaveMessage(`עורך עכשיו את ${receipt.tool} מתאריך ${formatDateLabel(receipt.date)}.`);
    setActiveTab("manual");
    window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function handleSave() {
    if (!form.tool || !form.date || !form.description || !form.originalAmount) return setSaveError("יש למלא ספק, תאריך, תיאור וסכום לפני שמירה.");
    if (gatewayStatus !== "online" && bridgeStatus !== "online") return setSaveError("אין כרגע נתיב שמירה זמין. צריך שער מאובטח פעיל או גשר מקומי פעיל.");
    setIsSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const result = await saveMutation(editingReceipt ? "PUT" : "POST");
      startTransition(() => {
        setManualReceipts((current) => sortReceipts([result.entry, ...current.filter((receipt) => receipt.id !== result.entry.id)]));
        resetEditor();
        setSaveMessage(mutationMessage(result.action, result.commit, result.channel));
      });
      await Promise.all([checkGateway(), checkBridge()]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "שמירת הקבלה נכשלה.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(receipt: ManualReceiptRecord) {
    if (!window.confirm(`למחוק את הקבלה של ${receipt.tool} מתאריך ${formatDateLabel(receipt.date)}?`)) return;
    if (gatewayStatus !== "online" && bridgeStatus !== "online") return setSaveError("אין כרגע נתיב שמירה זמין. צריך שער מאובטח פעיל או גשר מקומי פעיל.");
    setDeletingReceiptId(receipt.id);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const result = await deleteMutation(receipt.id);
      startTransition(() => {
        setManualReceipts((current) => current.filter((item) => item.id !== receipt.id));
        if (editingReceiptId === receipt.id) resetEditor();
        setSaveMessage(mutationMessage(result.action, result.commit, result.channel));
      });
      await Promise.all([checkGateway(), checkBridge()]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "מחיקת הקבלה נכשלה.");
    } finally {
      setDeletingReceiptId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs tracking-[0.18em] text-zinc-500">Secure Import</p><h2 className="mt-2 text-2xl font-semibold text-white">שער ייבוא מאובטח</h2></div><Badge variant="outline" className={statusBadgeClasses(gatewayStatus)}>{gatewayStatus === "online" ? "פעיל" : gatewayStatus === "checking" ? "בודק" : gatewayStatus === "not-configured" ? "לא הוגדר" : "לא זמין"}</Badge></div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{gatewayMessage}</p>
          <Button variant="outline" className="mt-5 border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]" onClick={() => void checkGateway()}><RefreshCw className="size-4" />בדוק שער מאובטח</Button>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs tracking-[0.18em] text-zinc-500">Local Fallback</p><h2 className="mt-2 text-2xl font-semibold text-white">גשר מקומי</h2></div><Badge variant="outline" className={statusBadgeClasses(bridgeStatus)}>{bridgeStatus === "online" ? "פעיל" : bridgeStatus === "checking" ? "בודק" : "לא זמין"}</Badge></div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{bridgeMessage}</p>
          <code className="mt-5 block rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-cyan-200">python manual_receipt_bridge.py</code>
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-5 shadow-none">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs tracking-[0.18em] text-zinc-500">Sync</p><h2 className="mt-2 text-2xl font-semibold text-white">מה מתעדכן</h2></div><PlugZap className="size-5 text-cyan-300" /></div>
          <div className="mt-5 grid gap-3 text-sm text-zinc-400"><div className="rounded-2xl border border-white/8 bg-black/20 p-4">כל פעולה מעדכנת את מקור האמת ב־<code>manual_receipts.json</code>.</div><div className="rounded-2xl border border-white/8 bg-black/20 p-4">לאחר שמירה, עריכה או מחיקה נבנים מחדש האקסל והדשבורד.</div></div>
        </Card>
      </section>

      <div ref={editorRef}>
        <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "manual" | "pdf")} className="gap-6">
            <div className="flex flex-col gap-4 border-b border-white/6 pb-6 md:flex-row md:items-center md:justify-between">
              <div><p className="text-[11px] tracking-[0.18em] text-zinc-500">{editingReceipt ? "עריכת קבלה" : "ייבוא חדש"}</p><h2 className="mt-2 text-2xl font-semibold text-white">{editingReceipt ? "ערוך את פרטי הקבלה" : "הוסף קבלה שלא הגיעה למייל"}</h2></div>
              <TabsList variant="line" className="bg-transparent p-0"><TabsTrigger value="manual" className="data-active:text-white">הזנת נתונים</TabsTrigger><TabsTrigger value="pdf" className="data-active:text-white">העלאת PDF</TabsTrigger></TabsList>
            </div>
            {editingReceipt ? <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">עורך עכשיו את {editingReceipt.tool} מתאריך {formatDateLabel(editingReceipt.date)}. {editingReceipt.attachment_path ? "ה־PDF הקיים יישאר מחובר עד שתעלה חדש." : "אפשר לשמור רק שינויי שדות או לצרף PDF חדש."}</div> : null}

            <TabsContent value="manual" className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2"><label className="text-sm font-medium text-zinc-100">ספק</label><Input list="known-vendors" value={form.tool} onChange={(event) => setForm((current) => ({ ...current, tool: event.target.value }))} placeholder="למשל Dzine" className="h-11 border-white/10 bg-black/20 text-zinc-100" /><datalist id="known-vendors">{knownVendors.map((vendor) => <option key={vendor} value={vendor} />)}</datalist></div>
                <div className="space-y-2"><label className="text-sm font-medium text-zinc-100">תאריך קבלה</label><Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="h-11 border-white/10 bg-black/20 text-zinc-100" />{monthHref ? <Link className="text-sm text-cyan-300 transition-colors hover:text-cyan-200" href={monthHref}>הדוח שיתעדכן: {monthKeyFromDate(form.date)}</Link> : null}</div>
                <div className="space-y-2"><label className="text-sm font-medium text-zinc-100">מטבע</label><Select value={form.currency} onValueChange={(value: "USD" | "ILS") => setForm((current) => ({ ...current, currency: value }))}><SelectTrigger className="h-11 border-white/10 bg-black/20 text-zinc-100"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="ILS">ILS</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium text-zinc-100">סכום מקורי</label><Input type="number" inputMode="decimal" step="0.01" value={form.originalAmount} onChange={(event) => setForm((current) => ({ ...current, originalAmount: event.target.value }))} placeholder="0.00" className="h-11 border-white/10 bg-black/20 text-zinc-100" /></div>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium text-zinc-100">תיאור החיוב</label><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="למשל Dzine Video Top-Up 1" className="h-11 border-white/10 bg-black/20 text-zinc-100" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-zinc-100">הערות</label><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="הערה פנימית או מקור הקבלה" className="min-h-28 border-white/10 bg-black/20 text-zinc-100" /></div>
            </TabsContent>

            <TabsContent value="pdf" className="space-y-6">
              <div className="rounded-[26px] border border-dashed border-cyan-400/20 bg-cyan-400/[0.04] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-base font-medium text-white">העלה קבלת PDF</p><p className="mt-2 text-sm leading-6 text-zinc-400">אפשר לנתח את הקובץ, למלא את הטופס, ולשמור קבלה חדשה או לעדכן קיימת.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-100 hover:bg-white/[0.06]"><Upload className="size-4" />בחר PDF<input type="file" accept="application/pdf" className="hidden" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></label></div>
                {selectedFile ? <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-300">קובץ נבחר: {selectedFile.name}</div> : editingReceipt?.attachment_name ? <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-zinc-400">כרגע מקושר: {editingReceipt.attachment_name}</div> : null}
                <div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => void handleParsePdf()} disabled={!selectedFile || isParsingPdf} className="bg-cyan-400 text-black hover:bg-cyan-300">{isParsingPdf ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}חלץ נתונים מה־PDF</Button><p className="self-center text-sm text-zinc-500">אחרי החילוץ, השדות יתמלאו ככל האפשר.</p></div>
              </div>
              {parseResult ? <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"><Card className="border-white/8 bg-black/20 p-5 shadow-none"><p className="text-sm font-medium text-white">מה זוהה</p><div className="mt-4 space-y-3 text-sm text-zinc-400"><p>ספק: <span className="text-zinc-100">{parseResult.suggestedTool ?? "לא זוהה"}</span></p><p>שירות: <span className="text-zinc-100">{parseResult.suggestedDescription ?? "לא זוהה"}</span></p><p>תאריך: <span className="text-zinc-100">{parseResult.suggestedDate ?? "לא זוהה"}</span></p><p>מטבע: <span className="text-zinc-100">{parseResult.suggestedCurrency ?? "לא זוהה"}</span></p><p>סכום: <span className="text-zinc-100">{parseResult.suggestedAmount ?? "לא זוהה"}</span></p></div></Card><Card className="border-white/8 bg-black/20 p-5 shadow-none"><p className="text-sm font-medium text-white">תצוגה מקדימה</p><pre className="mt-4 max-h-[280px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-400">{parseResult.textPreview || "לא נמצא טקסט קריא בקובץ."}</pre></Card></div> : null}
            </TabsContent>
          </Tabs>

          {saveMessage || saveError ? <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${saveError ? "border-rose-400/20 bg-rose-400/10 text-rose-200" : "border-cyan-400/20 bg-cyan-400/10 text-cyan-100"}`}>{saveError ?? saveMessage}</div> : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 pt-6">
            <div className="text-sm text-zinc-500"><p>השמירה משתמשת קודם בשער המאובטח, ואם הוא לא זמין עוברת לגשר המקומי.</p><p className="mt-1">עריכה ומחיקה משתמשות באותו מסלול, כך שכל שינוי יעדכן גם את מקור הנתונים וגם את הדשבורד.</p></div>
            <div className="flex flex-wrap gap-2">{editingReceipt ? <Button type="button" variant="outline" onClick={resetEditor} disabled={isSaving} className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]"><X className="size-4" />בטל עריכה</Button> : null}<Button type="button" onClick={() => void handleSave()} disabled={isSaving} className="bg-cyan-400 text-black hover:bg-cyan-300">{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{editingReceipt ? "עדכן, בנה מחדש ופרסם" : "שמור, בנה מחדש ופרסם"}</Button></div>
          </div>
        </Card>
      </div>

      <Card className="border-white/8 bg-white/[0.03] p-6 shadow-none">
        <div className="flex items-end justify-between gap-4 border-b border-white/6 pb-6"><div><p className="text-[11px] tracking-[0.18em] text-zinc-500">קבלות ידניות</p><h2 className="mt-2 text-2xl font-semibold text-white">כל הקבלות הידניות שהוזנו</h2></div><Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">{manualReceipts.length} פריטים</Badge></div>
        <div className="mt-6 space-y-3">
          {manualReceipts.length ? manualReceipts.map((receipt) => <div key={receipt.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{receipt.tool}</p>{editingReceiptId === receipt.id ? <Badge variant="outline" className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">בעריכה</Badge> : null}</div><p className="mt-1 text-sm text-zinc-400">{receipt.description}</p>{receipt.notes ? <p className="mt-3 text-sm text-zinc-500">{receipt.notes}</p> : null}</div><div className="text-right"><p className="font-medium text-cyan-200">{formatOriginalAmount(receipt.original_amount, receipt.currency)}</p><p className="mt-1 text-sm text-zinc-500">{formatDateLabel(receipt.date)}</p></div></div><div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">{receipt.entry_mode === "pdf-upload" ? "PDF" : "ידני"}</Badge><Badge variant="outline" className="border-white/10 bg-black/20 text-zinc-300">{receipt.currency}</Badge><Link href={monthReportHref(monthKeyFromDate(receipt.date))} className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 transition-colors hover:bg-cyan-400/15">לדוח {monthKeyFromDate(receipt.date)}</Link></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => handleEdit(receipt)} disabled={isSaving || deletingReceiptId !== null} className="border-white/10 bg-black/20 text-zinc-100 hover:bg-white/[0.08]"><PencilLine className="size-4" />עריכה</Button><Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete(receipt)} disabled={isSaving || deletingReceiptId !== null}>{deletingReceiptId === receipt.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}מחיקה</Button></div></div></div>) : <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-zinc-400">עדיין לא נשמרו קבלות ידניות. ברגע שתוסיף אחת, היא תופיע כאן יחד עם אפשרויות עריכה ומחיקה.</div>}
        </div>
      </Card>
    </div>
  );
}
