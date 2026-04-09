const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  אפריל: 4,
  אפר: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  אוג: 8,
  ספטמבר: 9,
  ספט: 9,
  אוקטובר: 10,
  אוק: 10,
  נובמבר: 11,
  נוב: 11,
  דצמבר: 12,
  דצמ: 12,
};

const MONTH_PATTERN = Object.keys(MONTH_NAME_TO_NUMBER)
  .sort((left, right) => right.length - left.length)
  .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const TOOL_ALIASES: Record<string, string> = {
  openai: "OpenAI",
  chatgpt: "OpenAI",
  anthropic: "Anthropic",
  claude: "Anthropic",
  "google workspace": "Google Workspace",
  workspace: "Google Workspace",
  capcut: "CapCut",
  "eleven labs": "Eleven Labs",
  elevenlabs: "Eleven Labs",
  make: "Make",
  manychat: "Manychat",
  timeless: "Timeless",
  lovable: "Lovable",
  runway: "Runway ML",
  replicate: "Replicate",
  recraft: "Recraft",
  ideogram: "Ideogram AI",
  genspark: "Genspark",
  meta: "Meta (Ads)",
  "facebook ads": "Meta (Ads)",
  ionos: "IONOS",
  manus: "Manus AI",
  higgsfield: "Higgsfield",
  astria: "Astria",
  hedra: "Hedra",
  "dzine.ai": "Dzine",
  dzine: "Dzine",
};

const BLOCKED_DESCRIPTION_TOKENS = [
  "subtotal",
  "total",
  "amount paid",
  "payment history",
  "receipt number",
  "payment method",
  "description qty unit price amount",
  "charged ",
  "using 1 usd",
  "page ",
];

export type ManualReceiptParseResult = {
  suggestedDate: string | null;
  suggestedCurrency: "USD" | "ILS" | null;
  suggestedAmount: number | null;
  suggestedTool: string | null;
  suggestedDescription: string | null;
  textPreview: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanMonthToken(value: string) {
  return value.replace(/[^A-Za-z\u0590-\u05FF]/g, "").trim().toLowerCase();
}

function resolveMonthNumber(token: string) {
  const cleaned = cleanMonthToken(token);
  if (!cleaned) return null;

  const candidates = [cleaned];
  if (cleaned.length > 3 && ["ב", "ל", "מ", "ה", "ו", "כ", "ש"].includes(cleaned[0] ?? "")) {
    candidates.push(cleaned.slice(1));
  }

  for (const candidate of candidates) {
    if (MONTH_NAME_TO_NUMBER[candidate]) return MONTH_NAME_TO_NUMBER[candidate];
  }

  let bestScore = 0;
  let bestMonth: number | null = null;
  for (const [name, monthNumber] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    const longer = Math.max(name.length, cleaned.length);
    let same = 0;
    for (let index = 0; index < Math.min(name.length, cleaned.length); index += 1) {
      if (name[index] === cleaned[index]) same += 1;
    }
    const score = longer ? same / longer : 0;
    if (score > bestScore) {
      bestScore = score;
      bestMonth = monthNumber;
    }
  }

  return bestScore >= 0.55 ? bestMonth : null;
}

function buildIsoDate(dayText: string, monthToken: string, yearText: string) {
  const month = resolveMonthNumber(monthToken);
  const day = Number(dayText);
  const year = Number(yearText);
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${yearText.padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDateFromLine(line: string) {
  const compactLine = normalizeWhitespace(line);
  const simplePatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g,
  ];

  for (const pattern of simplePatterns) {
    const matches = compactLine.match(pattern) ?? [];
    for (const match of matches) {
      const normalized = match.replace(/[./]/g, "-");
      const parts = normalized.split("-");
      if (parts[0]?.length === 4) return normalized;
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
  }

  const monthPatterns = [
    new RegExp(`\\b(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s+(?<month>${MONTH_PATTERN})\\s+(?<year>\\d{4})\\b`, "iu"),
    new RegExp(`\\b(?<month>${MONTH_PATTERN})\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(?<year>\\d{4})\\b`, "iu"),
    new RegExp(`\\b(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s+(?<year>\\d{4})\\s+(?<month>${MONTH_PATTERN})\\b`, "iu"),
    new RegExp(`\\b(?<month>${MONTH_PATTERN})\\s+(?<year>\\d{4})\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?\\b`, "iu"),
  ];

  for (const pattern of monthPatterns) {
    const match = compactLine.match(pattern);
    const groups = match?.groups;
    if (!groups) continue;
    const isoDate = buildIsoDate(groups.day, groups.month, groups.year);
    if (isoDate) return isoDate;
  }

  const tokens = compactLine.match(/[A-Za-z\u0590-\u05FF]+|\d{1,4}/g) ?? [];
  for (let index = 0; index < tokens.length; index += 1) {
    const month = resolveMonthNumber(tokens[index] ?? "");
    if (!month) continue;
    const nearby = tokens
      .slice(Math.max(0, index - 2), Math.min(tokens.length, index + 3))
      .filter((token) => /^\d+$/.test(token));
    const day = nearby.find((token) => Number(token) >= 1 && Number(token) <= 31 && token.length <= 2);
    const year = nearby.find((token) => token.length === 4 && Number(token) >= 2000 && Number(token) <= 2100);
    if (day && year) return `${year}-${String(month).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  }

  return null;
}

function extractDateFromText(text: string, fileName?: string | null) {
  const combined = fileName ? `${text}\n${fileName}` : text;
  for (const line of combined.split(/\r?\n/)) {
    const parsed = extractDateFromLine(line);
    if (parsed) return parsed;
  }
  return extractDateFromLine(combined);
}

function amountCandidates(pattern: RegExp, text: string) {
  return [...text.matchAll(pattern)]
    .map((match) => Number((match[1] ?? "").replace(/,/g, "").trim()))
    .filter((value) => Number.isFinite(value));
}

function extractAmountFromText(text: string) {
  const lines = text.split(/\r?\n/).map(normalizeWhitespace);
  const labeledPatterns: Array<{ currency: "USD" | "ILS"; pattern: RegExp }> = [
    {
      currency: "USD",
      pattern: /(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|\$)/gi,
    },
    {
      currency: "USD",
      pattern: /(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*(?:USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
    },
    {
      currency: "ILS",
      pattern: /(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₪|ILS|NIS)/gi,
    },
    {
      currency: "ILS",
      pattern: /(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*(?:₪|ILS|NIS)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi,
    },
  ];

  for (const line of lines) {
    const lowered = line.toLowerCase();
    if (lowered.includes("subtotal")) continue;
    for (const { currency, pattern } of labeledPatterns) {
      const matches = amountCandidates(pattern, line);
      if (matches.length) return { currency, amount: Math.round(matches.at(-1)! * 100) / 100 };
    }
  }

  const usd = [
    ...amountCandidates(/(?:USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi, text),
    ...amountCandidates(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|\$)/gi, text),
  ];
  if (usd.length) return { currency: "USD" as const, amount: Math.max(...usd) };

  const ils = [
    ...amountCandidates(/(?:₪|ILS|NIS)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi, text),
    ...amountCandidates(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₪|ILS|NIS)/gi, text),
  ];
  if (ils.length) return { currency: "ILS" as const, amount: Math.max(...ils) };

  return { currency: null, amount: null };
}

function extractToolFromText(text: string, fileName?: string | null) {
  const haystack = `${text}\n${fileName ?? ""}`.toLowerCase();
  return (
    Object.entries(TOOL_ALIASES)
      .sort((left, right) => right[0].length - left[0].length)
      .find(([alias]) => haystack.includes(alias))?.[1] ?? null
  );
}

function cleanDescriptionCandidate(value: string) {
  return normalizeWhitespace(value)
    .replace(/(?:\s+(?:[0-9]+\.[0-9]{1,2}\s*(?:USD|\$|₪|ILS|NIS)?|[0-9]+\s*(?:USD|\$|₪|ILS|NIS)))+\s*$/i, "")
    .replace(/\s+(?:Qty|Unit price|Amount)\b.*$/i, "")
    .replace(/^[\-:\s]+|[\-:\s]+$/g, "");
}

function extractDescriptionFromText(text: string, tool: string | null) {
  const lines = text.split(/\r?\n/).map(normalizeWhitespace);
  for (const line of lines) {
    if (!line || line.length < 4) continue;
    const lowered = line.toLowerCase();
    if (BLOCKED_DESCRIPTION_TOKENS.some((token) => lowered.includes(token))) continue;
    if (tool && !lowered.includes(tool.toLowerCase())) continue;
    if (!/[A-Za-z\u0590-\u05FF]/.test(line)) continue;
    if (!/\d+(?:\.\d{1,2})?\s*(?:USD|\$|₪|ILS|NIS)/i.test(line)) continue;
    const cleaned = cleanDescriptionCandidate(line);
    if (cleaned) return cleaned;
  }
  return tool;
}

export async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const arrayBuffer = await file.arrayBuffer();
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pageTexts.push(text);
  }

  return pageTexts.join("\n").trim();
}

export async function parseManualReceiptPdf(file: File): Promise<ManualReceiptParseResult> {
  const text = await extractPdfText(file);
  const { currency, amount } = extractAmountFromText(text);
  const tool = extractToolFromText(text, file.name);
  const description = extractDescriptionFromText(text, tool);

  return {
    suggestedDate: extractDateFromText(text, file.name),
    suggestedCurrency: currency,
    suggestedAmount: amount,
    suggestedTool: tool,
    suggestedDescription: description,
    textPreview: text.slice(0, 2400),
  };
}
