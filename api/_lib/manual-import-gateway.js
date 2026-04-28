const crypto = require("node:crypto");

function sanitizeEnv(value) {
  // Strip BOM (U+FEFF), zero-width spaces, CR/LF, and surrounding whitespace.
  // Vercel env vars sometimes carry a UTF-8 BOM from copy-paste, which breaks
  // fetch() Headers (ByteString conversion error at "Bearer <BOM>...").
  return String(value || "").replace(/^[﻿​\s]+|[﻿​\s]+$/g, "");
}

const DEFAULT_BRANCH = sanitizeEnv(process.env.MANUAL_IMPORT_GITHUB_BRANCH) || "master";
const OWNER = sanitizeEnv(process.env.MANUAL_IMPORT_GITHUB_OWNER);
const REPO = sanitizeEnv(process.env.MANUAL_IMPORT_GITHUB_REPO);
const TOKEN = sanitizeEnv(process.env.MANUAL_IMPORT_GITHUB_TOKEN);
const ALLOWED_ORIGINS = sanitizeEnv(process.env.MANUAL_IMPORT_ALLOWED_ORIGINS)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeToolName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeDescription(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "receipt";
}

function textToBase64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function dataUrlToBase64(dataUrl) {
  const parts = String(dataUrl || "").split(",", 2);
  return parts[1] || parts[0] || "";
}

function decodeGithubContent(content) {
  return Buffer.from(String(content || "").replace(/\n/g, ""), "base64").toString("utf8");
}

function buildResponse(res, status, payload, origin) {
  if (origin && isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, PUT, DELETE, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(status).json(payload);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes("*")) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function assertConfigured() {
  if (!OWNER || !REPO || !TOKEN) {
    throw new Error("Secure manual import gateway is missing GitHub environment variables.");
  }
}

async function github(path, init = {}) {
  assertConfigured();
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "rt-ai-manual-import-gateway",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GitHub request failed with ${response.status}.`);
  }

  return response.json();
}

async function getRepositoryFile(path) {
  assertConfigured();
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${TOKEN}`,
        "User-Agent": "rt-ai-manual-import-gateway",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Could not read ${path} from GitHub.`);
  }

  return response.json();
}

async function putRepositoryFile(path, message, contentBase64, sha) {
  return github(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: DEFAULT_BRANCH,
      sha,
    }),
  });
}

async function deleteRepositoryFile(path, message, sha) {
  return github(`/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "DELETE",
    body: JSON.stringify({
      message,
      branch: DEFAULT_BRANCH,
      sha,
    }),
  });
}

function receiptIdentity(entry) {
  return [
    entry.date,
    normalizeToolName(entry.tool).toLowerCase(),
    normalizeDescription(entry.description).toLowerCase(),
    entry.currency,
    Number(entry.original_amount).toFixed(2),
  ].join("|");
}

function normalizeEntry(entry) {
  const normalized = {
    tool: normalizeToolName(entry.tool),
    date: String(entry.date || "").trim(),
    description: normalizeDescription(entry.description),
    currency: String(entry.currency || "USD").trim().toUpperCase(),
    original_amount: Math.round(Number(entry.original_amount || 0) * 100) / 100,
    notes: normalizeDescription(entry.notes || "") || null,
    entry_mode: entry.entry_mode || null,
  };

  if (!normalized.tool || !normalized.date || !normalized.description || !normalized.original_amount) {
    throw createHttpError(400, "Tool, date, description, and amount are required.");
  }

  if (!["USD", "ILS"].includes(normalized.currency)) {
    throw createHttpError(400, "Currency must be USD or ILS.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.date)) {
    throw createHttpError(400, "Date must be in YYYY-MM-DD format.");
  }

  return normalized;
}

function buildReceiptId(entry) {
  const fingerprint = crypto
    .createHash("sha1")
    .update(`${entry.date}|${entry.tool}|${entry.description}|${entry.currency}|${entry.original_amount.toFixed(2)}`)
    .digest("hex")
    .slice(0, 10);

  return `manual-${entry.date}-${slugify(entry.tool)}-${fingerprint}`;
}

function buildAttachmentPath(entry) {
  return `manual_invoices/${entry.date}-${slugify(entry.tool)}-${entry.id}.pdf`;
}

function sortEntries(entries) {
  return [...entries].sort((left, right) =>
    `${left.date}-${left.tool}-${left.description}`.localeCompare(`${right.date}-${right.tool}-${right.description}`),
  );
}

function receiptsMatch(left, right) {
  return (
    left.id === right.id &&
    left.date === right.date &&
    left.tool === right.tool &&
    left.description === right.description &&
    left.currency === right.currency &&
    Number(left.original_amount).toFixed(2) === Number(right.original_amount).toFixed(2) &&
    (left.attachment_path || null) === (right.attachment_path || null) &&
    (left.attachment_name || null) === (right.attachment_name || null) &&
    (left.entry_mode || null) === (right.entry_mode || null) &&
    (left.notes || null) === (right.notes || null) &&
    (left.created_at || null) === (right.created_at || null) &&
    (left.entry_source || "manual") === (right.entry_source || "manual")
  );
}

function buildManualReceipt(entry, options = {}) {
  const { existingEntry = null, fileName = null } = options;
  const normalized = normalizeEntry(entry);
  const id = existingEntry?.id || entry.id || buildReceiptId(normalized);
  const manualReceipt = {
    id,
    date: normalized.date,
    tool: normalized.tool,
    description: normalized.description,
    currency: normalized.currency,
    original_amount: normalized.original_amount,
    attachment_path: existingEntry?.attachment_path || null,
    attachment_name: existingEntry?.attachment_name || null,
    entry_mode:
      normalized.entry_mode ||
      existingEntry?.entry_mode ||
      (fileName || existingEntry?.attachment_path ? "pdf-upload" : "manual-form"),
    notes: normalized.notes,
    created_at: existingEntry?.created_at || new Date().toISOString().slice(0, 19),
    entry_source: existingEntry?.entry_source || "manual",
  };

  if (fileName) {
    manualReceipt.attachment_path = manualReceipt.attachment_path || buildAttachmentPath(manualReceipt);
    manualReceipt.attachment_name = fileName;
  }

  return manualReceipt;
}

async function saveManualReceipt(entryPayload, fileName, fileBase64) {
  const entry = buildManualReceipt(entryPayload, { fileName });
  const currentFile = await getRepositoryFile("manual_receipts.json");
  const currentEntries = currentFile ? JSON.parse(decodeGithubContent(currentFile.content)) : [];

  if (currentEntries.some((currentEntry) => receiptIdentity(currentEntry) === receiptIdentity(entry))) {
    throw createHttpError(409, "החיוב הזה כבר קיים במערכת ולכן לא נשמר שוב.");
  }

  if (entry.attachment_path && fileBase64) {
    await putRepositoryFile(
      entry.attachment_path,
      `Manual receipt PDF: ${entry.tool} ${entry.date}`,
      dataUrlToBase64(fileBase64),
      undefined,
    );
  }

  const nextEntries = sortEntries([...currentEntries, entry]);
  const commit = await putRepositoryFile(
    "manual_receipts.json",
    `Manual import: add receipt for ${entry.tool} ${entry.date}`,
    textToBase64(`${JSON.stringify(nextEntries, null, 2)}\n`),
    currentFile ? currentFile.sha : undefined,
  );

  return {
    entry,
    commit: commit.commit.sha.slice(0, 7),
  };
}

async function updateManualReceipt(receiptId, entryPayload, fileName, fileBase64) {
  if (!receiptId) {
    throw createHttpError(400, "Missing receipt id for update.");
  }

  const currentFile = await getRepositoryFile("manual_receipts.json");
  const currentEntries = currentFile ? JSON.parse(decodeGithubContent(currentFile.content)) : [];
  const currentIndex = currentEntries.findIndex((entry) => entry.id === receiptId);

  if (currentIndex === -1) {
    throw createHttpError(404, "הקבלה שביקשת לערוך כבר לא קיימת.");
  }

  const existingEntry = currentEntries[currentIndex];
  const updatedEntry = buildManualReceipt(entryPayload, {
    existingEntry,
    fileName,
  });

  if (
    currentEntries.some(
      (currentEntry, index) =>
        index !== currentIndex && receiptIdentity(currentEntry) === receiptIdentity(updatedEntry),
    )
  ) {
    throw createHttpError(409, "כבר קיימת קבלה ידנית אחרת עם אותם פרטים.");
  }

  if (updatedEntry.attachment_path && fileBase64) {
    const existingAttachment = await getRepositoryFile(updatedEntry.attachment_path);
    await putRepositoryFile(
      updatedEntry.attachment_path,
      `Manual receipt PDF: update ${updatedEntry.tool} ${updatedEntry.date}`,
      dataUrlToBase64(fileBase64),
      existingAttachment ? existingAttachment.sha : undefined,
    );
  }

  if (!fileBase64 && receiptsMatch(existingEntry, updatedEntry)) {
    return {
      entry: updatedEntry,
      commit: "no-change",
    };
  }

  const nextEntries = sortEntries(
    currentEntries.map((currentEntry, index) => (index === currentIndex ? updatedEntry : currentEntry)),
  );
  const commit = await putRepositoryFile(
    "manual_receipts.json",
    `Manual import: update receipt for ${updatedEntry.tool} ${updatedEntry.date}`,
    textToBase64(`${JSON.stringify(nextEntries, null, 2)}\n`),
    currentFile ? currentFile.sha : undefined,
  );

  return {
    entry: updatedEntry,
    commit: commit.commit.sha.slice(0, 7),
  };
}

async function deleteManualReceipt(receiptId) {
  if (!receiptId) {
    throw createHttpError(400, "Missing receipt id for delete.");
  }

  const currentFile = await getRepositoryFile("manual_receipts.json");
  const currentEntries = currentFile ? JSON.parse(decodeGithubContent(currentFile.content)) : [];
  const currentIndex = currentEntries.findIndex((entry) => entry.id === receiptId);

  if (currentIndex === -1) {
    throw createHttpError(404, "הקבלה שביקשת למחוק כבר לא קיימת.");
  }

  const deletedEntry = currentEntries[currentIndex];
  const nextEntries = sortEntries(currentEntries.filter((entry) => entry.id !== receiptId));
  const commit = await putRepositoryFile(
    "manual_receipts.json",
    `Manual import: delete receipt for ${deletedEntry.tool} ${deletedEntry.date}`,
    textToBase64(`${JSON.stringify(nextEntries, null, 2)}\n`),
    currentFile ? currentFile.sha : undefined,
  );

  let finalCommit = commit.commit.sha.slice(0, 7);

  if (deletedEntry.attachment_path) {
    try {
      const attachmentFile = await getRepositoryFile(deletedEntry.attachment_path);
      if (attachmentFile) {
        const attachmentCommit = await deleteRepositoryFile(
          deletedEntry.attachment_path,
          `Manual receipt PDF: delete ${deletedEntry.tool} ${deletedEntry.date}`,
          attachmentFile.sha,
        );
        finalCommit = attachmentCommit.commit.sha.slice(0, 7);
      }
    } catch {
      // The source of truth is manual_receipts.json, so a stale PDF should not block the delete action.
    }
  }

  return {
    entry: deletedEntry,
    commit: finalCommit,
  };
}

module.exports = {
  OWNER,
  REPO,
  DEFAULT_BRANCH,
  buildResponse,
  isOriginAllowed,
  saveManualReceipt,
  updateManualReceipt,
  deleteManualReceipt,
  assertConfigured,
};
