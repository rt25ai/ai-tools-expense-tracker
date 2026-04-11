import type { ManualReceiptRecord } from "@/lib/manual-receipts";

const GITHUB_API_BASE = "https://api.github.com";
const TOKEN_STORAGE_KEY = "manual_import_github_token";

export type GithubDirectConfig = {
  owner: string;
  repo: string;
  branch: string;
};

export type GithubMutationResult = {
  entry: ManualReceiptRecord;
  commit: string;
};

// ── Token storage ──────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || null;
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// ── GitHub API helpers ─────────────────────────────────────────────────────

async function githubRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "rt-ai-expense-dashboard",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || `GitHub API ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function getRepoFile(config: GithubDirectConfig, token: string, filePath: string) {
  try {
    return (await githubRequest(
      `/repos/${config.owner}/${config.repo}/contents/${filePath}?ref=${encodeURIComponent(config.branch)}`,
      token,
    )) as { sha: string; content: string };
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null;
    throw error;
  }
}

async function putRepoFile(
  config: GithubDirectConfig,
  token: string,
  filePath: string,
  message: string,
  contentBase64: string,
  sha?: string,
) {
  return (await githubRequest(`/repos/${config.owner}/${config.repo}/contents/${filePath}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: contentBase64, branch: config.branch, ...(sha ? { sha } : {}) }),
  })) as { commit: { sha: string } };
}

// ── Encoding helpers ───────────────────────────────────────────────────────

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

// ── Entry helpers ──────────────────────────────────────────────────────────

function slugify(value: string): string {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "receipt"
  );
}

async function buildReceiptId(entry: {
  date: string;
  tool: string;
  description: string;
  currency: string;
  original_amount: number;
}): Promise<string> {
  const text = `${entry.date}|${entry.tool}|${entry.description}|${entry.currency}|${entry.original_amount.toFixed(2)}`;
  const buffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 10);
  return `manual-${entry.date}-${slugify(entry.tool)}-${hex}`;
}

function sortEntries(entries: ManualReceiptRecord[]): ManualReceiptRecord[] {
  return [...entries].sort((a, b) =>
    `${a.date}-${a.tool}-${a.description}`.localeCompare(`${b.date}-${b.tool}-${b.description}`),
  );
}

// ── Connection check ───────────────────────────────────────────────────────

export async function checkGithubDirectAccess(
  config: GithubDirectConfig,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await githubRequest(`/repos/${config.owner}/${config.repo}`, token);
    return { ok: true, message: "חיבור ישיר ל-GitHub פעיל ומוכן לשמירה." };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) return { ok: false, message: "הטוקן לא תקין או פג תוקף. עדכן אותו בהגדרות." };
    if (status === 404) return { ok: false, message: "הריפו לא נמצא. בדוק שה-Token מורשה לגשת לריפו." };
    return { ok: false, message: "לא ניתן להתחבר ל-GitHub. בדוק חיבור לאינטרנט." };
  }
}

// ── CRUD operations ────────────────────────────────────────────────────────

type EntryFields = {
  tool: string;
  date: string;
  description: string;
  currency: "USD" | "ILS";
  original_amount: number;
  notes: string | null;
  entry_mode: string;
};

function normalizeFields(fields: EntryFields): EntryFields {
  return {
    ...fields,
    tool: fields.tool.replace(/\s+/g, " ").trim(),
    description: fields.description.replace(/\s+/g, " ").trim(),
    notes: fields.notes?.replace(/\s+/g, " ").trim() || null,
    original_amount: Math.round(fields.original_amount * 100) / 100,
  };
}

export async function githubDirectCreate(
  config: GithubDirectConfig,
  token: string,
  fields: EntryFields,
): Promise<GithubMutationResult> {
  const normalized = normalizeFields(fields);
  const id = await buildReceiptId(normalized);
  const entry: ManualReceiptRecord = {
    id,
    date: normalized.date,
    tool: normalized.tool,
    description: normalized.description,
    currency: normalized.currency,
    original_amount: normalized.original_amount,
    attachment_path: null,
    attachment_name: null,
    entry_mode: normalized.entry_mode,
    notes: normalized.notes,
    created_at: new Date().toISOString().slice(0, 19),
    entry_source: "manual",
  };

  const currentFile = await getRepoFile(config, token, "manual_receipts.json");
  const currentEntries: ManualReceiptRecord[] = currentFile
    ? (JSON.parse(decodeBase64Utf8(currentFile.content)) as ManualReceiptRecord[])
    : [];

  if (currentEntries.some((e) => e.id === entry.id)) {
    throw new Error("החיוב הזה כבר קיים במערכת ולכן לא נשמר שוב.");
  }

  const nextEntries = sortEntries([...currentEntries, entry]);
  const result = await putRepoFile(
    config,
    token,
    "manual_receipts.json",
    `Manual import: add receipt for ${entry.tool} ${entry.date}`,
    encodeUtf8Base64(JSON.stringify(nextEntries, null, 2) + "\n"),
    currentFile?.sha,
  );

  return { entry, commit: result.commit.sha.slice(0, 7) };
}

export async function githubDirectUpdate(
  config: GithubDirectConfig,
  token: string,
  receiptId: string,
  fields: EntryFields,
): Promise<GithubMutationResult> {
  const currentFile = await getRepoFile(config, token, "manual_receipts.json");
  if (!currentFile) throw new Error("manual_receipts.json לא נמצא בריפו.");
  const currentEntries = JSON.parse(decodeBase64Utf8(currentFile.content)) as ManualReceiptRecord[];
  const idx = currentEntries.findIndex((e) => e.id === receiptId);
  if (idx === -1) throw new Error("הקבלה שביקשת לערוך כבר לא קיימת.");

  const existing = currentEntries[idx];
  const normalized = normalizeFields(fields);
  const updated: ManualReceiptRecord = {
    ...existing,
    tool: normalized.tool,
    date: normalized.date,
    description: normalized.description,
    currency: normalized.currency,
    original_amount: normalized.original_amount,
    notes: normalized.notes,
    entry_mode: normalized.entry_mode,
  };

  const nextEntries = sortEntries(currentEntries.map((e, i) => (i === idx ? updated : e)));
  const result = await putRepoFile(
    config,
    token,
    "manual_receipts.json",
    `Manual import: update receipt for ${updated.tool} ${updated.date}`,
    encodeUtf8Base64(JSON.stringify(nextEntries, null, 2) + "\n"),
    currentFile.sha,
  );

  return { entry: updated, commit: result.commit.sha.slice(0, 7) };
}

export async function githubDirectDelete(
  config: GithubDirectConfig,
  token: string,
  receiptId: string,
): Promise<GithubMutationResult> {
  const currentFile = await getRepoFile(config, token, "manual_receipts.json");
  if (!currentFile) throw new Error("manual_receipts.json לא נמצא בריפו.");
  const currentEntries = JSON.parse(decodeBase64Utf8(currentFile.content)) as ManualReceiptRecord[];
  const idx = currentEntries.findIndex((e) => e.id === receiptId);
  if (idx === -1) throw new Error("הקבלה שביקשת למחוק כבר לא קיימת.");

  const deleted = currentEntries[idx];
  const nextEntries = sortEntries(currentEntries.filter((e) => e.id !== receiptId));
  const result = await putRepoFile(
    config,
    token,
    "manual_receipts.json",
    `Manual import: delete receipt for ${deleted.tool} ${deleted.date}`,
    encodeUtf8Base64(JSON.stringify(nextEntries, null, 2) + "\n"),
    currentFile.sha,
  );

  return { entry: deleted, commit: result.commit.sha.slice(0, 7) };
}
