import type { ManualReceiptRecord } from "@/lib/manual-receipts";

const DEFAULT_CONFIG = {
  owner: "rt25ai",
  repo: "ai-tools-expense-tracker",
  branch: "master",
};

const STORAGE_KEY = "rt-ai-console-github-import";

export type GithubImportConfig = {
  owner: string;
  repo: string;
  branch: string;
  token: string;
};

export type SaveManualReceiptInput = {
  tool: string;
  date: string;
  description: string;
  currency: "USD" | "ILS";
  originalAmount: number;
  notes: string;
  selectedFile: File | null;
};

type GithubContentResponse = {
  sha: string;
  content: string;
};

function normalizeToolName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDescription(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "receipt";
}

function toBase64FromBytes(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function textToBase64(value: string) {
  return toBase64FromBytes(new TextEncoder().encode(value));
}

function decodeBase64Text(value: string) {
  const normalized = value.replace(/\n/g, "");
  const binary = atob(normalized);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

async function sha1(input: string) {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function githubRequest<T>(config: GithubImportConfig, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `GitHub request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function getRepositoryFile(config: GithubImportConfig, path: string): Promise<GithubContentResponse | null> {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${encodeURIComponent(config.branch)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${config.token}`,
      },
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Could not read ${path} from GitHub.`);
  }

  return (await response.json()) as GithubContentResponse;
}

async function putRepositoryFile(
  config: GithubImportConfig,
  path: string,
  message: string,
  contentBase64: string,
  sha?: string,
) {
  return githubRequest<{ commit: { sha: string } }>(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: contentBase64,
        sha,
        branch: config.branch,
      }),
    },
  );
}

function receiptIdentity(entry: Pick<ManualReceiptRecord, "date" | "tool" | "description" | "currency" | "original_amount">) {
  return [
    entry.date,
    normalizeToolName(entry.tool).toLowerCase(),
    normalizeDescription(entry.description).toLowerCase(),
    entry.currency,
    Number(entry.original_amount).toFixed(2),
  ].join("|");
}

async function buildEntry(input: SaveManualReceiptInput) {
  const tool = normalizeToolName(input.tool);
  const description = normalizeDescription(input.description);
  const originalAmount = Math.round(input.originalAmount * 100) / 100;
  const fingerprint = (await sha1(`${input.date}|${tool}|${description}|${input.currency}|${originalAmount.toFixed(2)}`)).slice(0, 10);
  const id = `manual-${input.date}-${slugify(tool)}-${fingerprint}`;
  const attachmentPath =
    input.selectedFile && input.selectedFile.name
      ? `manual_invoices/${input.date}-${slugify(tool)}-${id}${input.selectedFile.name.toLowerCase().endsWith(".pdf") ? ".pdf" : ".pdf"}`
      : null;

  const entry: ManualReceiptRecord = {
    id,
    date: input.date,
    tool,
    description,
    currency: input.currency,
    original_amount: originalAmount,
    notes: input.notes.trim() || null,
    attachment_path: attachmentPath,
    attachment_name: input.selectedFile?.name ?? null,
    entry_mode: input.selectedFile ? "pdf-upload" : "manual-form",
    created_at: new Date().toISOString().slice(0, 19),
    entry_source: "manual",
  };

  return entry;
}

export function loadGithubImportConfig(): GithubImportConfig {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CONFIG, token: "" };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG, token: "" };
    const parsed = JSON.parse(raw) as Partial<GithubImportConfig>;
    return {
      owner: parsed.owner || DEFAULT_CONFIG.owner,
      repo: parsed.repo || DEFAULT_CONFIG.repo,
      branch: parsed.branch || DEFAULT_CONFIG.branch,
      token: parsed.token || "",
    };
  } catch {
    return { ...DEFAULT_CONFIG, token: "" };
  }
}

export function saveGithubImportConfig(config: GithubImportConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isGithubImportConfigured(config: GithubImportConfig) {
  return Boolean(config.owner && config.repo && config.branch && config.token);
}

export async function saveManualReceiptToGithub(config: GithubImportConfig, input: SaveManualReceiptInput) {
  const entry = await buildEntry(input);

  const manualReceiptsFile = await getRepositoryFile(config, "manual_receipts.json");
  const currentReceipts = manualReceiptsFile
    ? (JSON.parse(decodeBase64Text(manualReceiptsFile.content)) as ManualReceiptRecord[])
    : [];

  const duplicate = currentReceipts.some((item) => receiptIdentity(item) === receiptIdentity(entry));
  if (duplicate) {
    throw new Error("החיוב הזה כבר קיים במערכת ולכן לא נשמר שוב.");
  }

  if (input.selectedFile && entry.attachment_path) {
    const fileBytes = new Uint8Array(await input.selectedFile.arrayBuffer());
    await putRepositoryFile(
      config,
      entry.attachment_path,
      `Manual receipt PDF: ${entry.tool} ${entry.date}`,
      toBase64FromBytes(fileBytes),
    );
  }

  const nextReceipts = [...currentReceipts, entry].sort((left, right) =>
    `${left.date}-${left.tool}-${left.description}`.localeCompare(`${right.date}-${right.tool}-${right.description}`),
  );

  const commit = await putRepositoryFile(
    config,
    "manual_receipts.json",
    `Manual import: add receipt for ${entry.tool} ${entry.date}`,
    textToBase64(`${JSON.stringify(nextReceipts, null, 2)}\n`),
    manualReceiptsFile?.sha,
  );

  return {
    entry,
    commit: commit.commit.sha.slice(0, 7),
  };
}
