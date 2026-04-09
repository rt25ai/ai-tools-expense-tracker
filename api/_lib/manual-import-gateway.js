const crypto = require("node:crypto");

const DEFAULT_BRANCH = process.env.MANUAL_IMPORT_GITHUB_BRANCH || "master";
const OWNER = process.env.MANUAL_IMPORT_GITHUB_OWNER;
const REPO = process.env.MANUAL_IMPORT_GITHUB_REPO;
const TOKEN = process.env.MANUAL_IMPORT_GITHUB_TOKEN;
const ALLOWED_ORIGINS = (process.env.MANUAL_IMPORT_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
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
    entry_mode: entry.entry_mode || "manual-form",
  };

  if (!normalized.tool || !normalized.date || !normalized.description || !normalized.original_amount) {
    throw new Error("Tool, date, description, and amount are required.");
  }

  if (!["USD", "ILS"].includes(normalized.currency)) {
    throw new Error("Currency must be USD or ILS.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  return normalized;
}

function buildManualReceipt(entry, fileName) {
  const normalized = normalizeEntry(entry);
  const fingerprint = crypto
    .createHash("sha1")
    .update(
      `${normalized.date}|${normalized.tool}|${normalized.description}|${normalized.currency}|${normalized.original_amount.toFixed(2)}`,
    )
    .digest("hex")
    .slice(0, 10);

  const id = `manual-${normalized.date}-${slugify(normalized.tool)}-${fingerprint}`;
  const attachmentPath = fileName ? `manual_invoices/${normalized.date}-${slugify(normalized.tool)}-${id}.pdf` : null;

  return {
    id,
    date: normalized.date,
    tool: normalized.tool,
    description: normalized.description,
    currency: normalized.currency,
    original_amount: normalized.original_amount,
    attachment_path: attachmentPath,
    attachment_name: fileName || null,
    entry_mode: normalized.entry_mode,
    notes: normalized.notes,
    created_at: new Date().toISOString().slice(0, 19),
    entry_source: "manual",
  };
}

async function saveManualReceipt(entryPayload, fileName, fileBase64) {
  const entry = buildManualReceipt(entryPayload, fileName);
  const currentFile = await getRepositoryFile("manual_receipts.json");
  const currentEntries = currentFile ? JSON.parse(decodeGithubContent(currentFile.content)) : [];

  if (currentEntries.some((currentEntry) => receiptIdentity(currentEntry) === receiptIdentity(entry))) {
    throw new Error("החיוב הזה כבר קיים במערכת ולכן לא נשמר שוב.");
  }

  if (entry.attachment_path && fileBase64) {
    await putRepositoryFile(
      entry.attachment_path,
      `Manual receipt PDF: ${entry.tool} ${entry.date}`,
      dataUrlToBase64(fileBase64),
      undefined,
    );
  }

  const nextEntries = [...currentEntries, entry].sort((left, right) =>
    `${left.date}-${left.tool}-${left.description}`.localeCompare(`${right.date}-${right.tool}-${right.description}`),
  );

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

module.exports = {
  OWNER,
  REPO,
  DEFAULT_BRANCH,
  buildResponse,
  isOriginAllowed,
  saveManualReceipt,
  assertConfigured,
};
