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
  "vat @",
  "tax invoice",
  "receipt for your purchase",
];

const MONEY_PATTERN = String.raw`[0-9][0-9,]*(?:\.[0-9]{1,2})?`;
const USD_CURRENCY_PATTERN = String.raw`(?:USD|\$)`;
const ILS_CURRENCY_PATTERN = String.raw`(?:₪|ILS|NIS|ג‚×|׳’ג€ֳ—)`;
const ANY_CURRENCY_PATTERN = String.raw`(?:${USD_CURRENCY_PATTERN}|${ILS_CURRENCY_PATTERN})`;

export type ManualReceiptParseResult = {
  suggestedDate: string | null;
  suggestedCurrency: "USD" | "ILS" | null;
  suggestedAmount: number | null;
  suggestedTool: string | null;
  suggestedDescription: string | null;
  textPreview: string;
};

type CurrencyAmountMatch = {
  amount: number;
  currency: "USD" | "ILS";
  index: number;
  priority: number;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function indexedAmountCandidates(pattern: RegExp, text: string) {
  return [...text.matchAll(pattern)]
    .map((match) => ({
      amount: Number((match[1] ?? "").replace(/,/g, "").trim()),
      index: match.index ?? -1,
    }))
    .filter((match) => Number.isFinite(match.amount));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
  const simplePatterns = [/\b\d{4}-\d{2}-\d{2}\b/g, /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g];

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

function extractAmountFromText(text: string) {
  const labeledPatterns: Array<{ currency: "USD" | "ILS"; priority: number; pattern: RegExp }> = [
    {
      currency: "USD",
      priority: 0,
      pattern: new RegExp(`\\b(?:amount paid|paid on|paid)\\b\\D*(${MONEY_PATTERN})\\s*(?:${USD_CURRENCY_PATTERN})`, "gi"),
    },
    {
      currency: "USD",
      priority: 0,
      pattern: new RegExp(`\\b(?:amount paid|paid on|paid)\\b\\D*(?:${USD_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"),
    },
    {
      currency: "USD",
      priority: 1,
      pattern: new RegExp(`\\btotal\\b\\D*(${MONEY_PATTERN})\\s*(?:${USD_CURRENCY_PATTERN})`, "gi"),
    },
    {
      currency: "USD",
      priority: 1,
      pattern: new RegExp(`\\btotal\\b\\D*(?:${USD_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"),
    },
    {
      currency: "ILS",
      priority: 0,
      pattern: new RegExp(`\\b(?:amount paid|paid on|paid)\\b\\D*(${MONEY_PATTERN})\\s*(?:${ILS_CURRENCY_PATTERN})`, "gi"),
    },
    {
      currency: "ILS",
      priority: 0,
      pattern: new RegExp(`\\b(?:amount paid|paid on|paid)\\b\\D*(?:${ILS_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"),
    },
    {
      currency: "ILS",
      priority: 1,
      pattern: new RegExp(`\\btotal\\b\\D*(${MONEY_PATTERN})\\s*(?:${ILS_CURRENCY_PATTERN})`, "gi"),
    },
    {
      currency: "ILS",
      priority: 1,
      pattern: new RegExp(`\\btotal\\b\\D*(?:${ILS_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"),
    },
    {
      currency: "ILS",
      priority: 2,
      pattern: new RegExp(`\\bcharged\\b\\D*(${MONEY_PATTERN})\\s*(?:${ILS_CURRENCY_PATTERN})`, "gi"),
    },
    {
      currency: "ILS",
      priority: 2,
      pattern: new RegExp(`\\bcharged\\b\\D*(?:${ILS_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"),
    },
  ];

  const labeledMatches: CurrencyAmountMatch[] = labeledPatterns
    .flatMap(({ currency, priority, pattern }) =>
      indexedAmountCandidates(pattern, text).map((match) => ({
        ...match,
        currency,
        priority,
      })),
    )
    .sort((left, right) => left.priority - right.priority || right.index - left.index);

  if (labeledMatches.length) {
    const bestMatch = labeledMatches[0]!;
    return { currency: bestMatch.currency, amount: roundMoney(bestMatch.amount) };
  }

  const usd = [
    ...indexedAmountCandidates(new RegExp(`(?:${USD_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"), text),
    ...indexedAmountCandidates(new RegExp(`(${MONEY_PATTERN})\\s*(?:${USD_CURRENCY_PATTERN})`, "gi"), text),
  ].sort((left, right) => left.index - right.index);
  if (usd.length) return { currency: "USD" as const, amount: roundMoney(usd.at(-1)!.amount) };

  const ils = [
    ...indexedAmountCandidates(new RegExp(`(?:${ILS_CURRENCY_PATTERN})\\s*(${MONEY_PATTERN})`, "gi"), text),
    ...indexedAmountCandidates(new RegExp(`(${MONEY_PATTERN})\\s*(?:${ILS_CURRENCY_PATTERN})`, "gi"), text),
  ].sort((left, right) => left.index - right.index);
  if (ils.length) return { currency: "ILS" as const, amount: roundMoney(ils.at(-1)!.amount) };

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
    .replace(/\bDescription\b\s*/i, "")
    .replace(
      new RegExp(`\\s+\\d+\\s+${MONEY_PATTERN}\\s*(?:${ANY_CURRENCY_PATTERN})(?:\\s+${MONEY_PATTERN}\\s*(?:${ANY_CURRENCY_PATTERN}))*\\s*$`, "i"),
      "",
    )
    .replace(new RegExp(`(?:\\s+${MONEY_PATTERN}\\s*(?:${ANY_CURRENCY_PATTERN}))+\\s*$`, "i"), "")
    .replace(/\s+this is (?:an?\s+)?receipt\b.*$/i, "")
    .replace(/\s+not a tax invoice\b.*$/i, "")
    .replace(/\s+(?:Qty|Unit price|Amount)\b.*$/i, "")
    .replace(/^[\-:\s]+|[\-:\s]+$/g, "");
}

function isAmountOnlyLine(value: string) {
  return new RegExp(`^(?:${ANY_CURRENCY_PATTERN}\\s*)?${MONEY_PATTERN}(?:\\s*(?:${ANY_CURRENCY_PATTERN}))?$`, "i").test(
    normalizeWhitespace(value),
  );
}

function isDescriptionHeading(value: string) {
  return /^description\b[:\s]*$/i.test(normalizeWhitespace(value));
}

function startsWithDescriptionHeading(value: string) {
  return /^description\b/i.test(normalizeWhitespace(value));
}

function isAmountHeading(value: string) {
  return /^amount(?:\s+in\s*\([^)]+\))?[:\s]*$/i.test(normalizeWhitespace(value));
}

function finalizeDescriptionCandidate(value: string, tool: string | null) {
  let candidate = cleanDescriptionCandidate(value);
  if (!candidate) return null;

  if (tool) {
    const escapedTool = escapeRegExp(tool);
    candidate = candidate
      .replace(new RegExp(`^${escapedTool}\\s+`, "i"), "")
      .replace(new RegExp(`\\s+${escapedTool}$`, "i"), "")
      .trim();
  }

  if (!candidate) return null;

  const lowered = candidate.toLowerCase();
  if (BLOCKED_DESCRIPTION_TOKENS.some((token) => lowered.includes(token))) return null;
  if (tool && lowered === tool.toLowerCase()) return null;

  return candidate;
}

function extractDescriptionFromTable(text: string, tool: string | null) {
  const lines = text.split(/\r?\n/).map(normalizeWhitespace);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!startsWithDescriptionHeading(line)) continue;

    const inlineCandidate = finalizeDescriptionCandidate(line.replace(/^description\b[:\s]*/i, ""), tool);
    if (inlineCandidate && !isAmountHeading(inlineCandidate) && !isAmountOnlyLine(inlineCandidate)) {
      return inlineCandidate;
    }

    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 5); nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (!nextLine || isAmountHeading(nextLine) || isAmountOnlyLine(nextLine)) continue;

      const candidate = finalizeDescriptionCandidate(nextLine, tool);
      if (candidate) return candidate;
    }
  }

  const rowPatterns = [
    new RegExp(
      `\\bDescription(?:\\s+Qty)?(?:\\s+Unit price)?(?:\\s+Amount)?\\b[:\\s]+(.+?)\\s+\\d+\\s+${MONEY_PATTERN}\\s*(?:${ANY_CURRENCY_PATTERN})(?:\\s+${MONEY_PATTERN}\\s*(?:${ANY_CURRENCY_PATTERN}))?`,
      "iu",
    ),
    new RegExp(
      `\\bDescription(?:\\s+Qty)?(?:\\s+Unit price)?(?:\\s+Amount)?\\b[:\\s]+(.+?)\\s+${MONEY_PATTERN}\\s*(?:${ANY_CURRENCY_PATTERN})`,
      "iu",
    ),
  ];

  for (const pattern of rowPatterns) {
    const match = text.match(pattern);
    const candidate = finalizeDescriptionCandidate(match?.[1] ?? "", tool);
    if (candidate) return candidate;
  }

  return null;
}

function extractDescriptionFromText(text: string, tool: string | null) {
  const tableDescription = extractDescriptionFromTable(text, tool);
  if (tableDescription) return tableDescription;

  const lines = text.split(/\r?\n/).map(normalizeWhitespace);
  let firstCandidate: string | null = null;

  for (const line of lines) {
    if (!line || line.length < 4) continue;

    const lowered = line.toLowerCase();
    if (BLOCKED_DESCRIPTION_TOKENS.some((token) => lowered.includes(token))) continue;
    if (isDescriptionHeading(line) || isAmountHeading(line) || isAmountOnlyLine(line)) continue;
    if (!/[A-Za-z\u0590-\u05FF]/.test(line)) continue;
    if (!new RegExp(`\\d+(?:\\.\\d{1,2})?\\s*(?:${ANY_CURRENCY_PATTERN})`, "i").test(line)) continue;

    const cleaned = finalizeDescriptionCandidate(line, tool);
    if (!cleaned) continue;

    if (tool && lowered.includes(tool.toLowerCase())) return cleaned;
    if (!firstCandidate) firstCandidate = cleaned;
  }

  return firstCandidate ?? tool;
}

export async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const arrayBuffer = await file.arrayBuffer();
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    pdfjs.GlobalWorkerOptions.workerSrc = `${basePath}/pdf.worker.min.mjs`;
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
    const parts: string[] = [];

    for (const item of content.items) {
      const value = "str" in item ? item.str : "";
      if (!value) continue;
      parts.push(value);
      if ("hasEOL" in item && item.hasEOL) parts.push("\n");
    }

    const text = parts
      .join(" ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (text) pageTexts.push(text);
  }

  return pageTexts.join("\n").trim();
}

export function parseManualReceiptText(text: string, fileName?: string | null): ManualReceiptParseResult {
  const { currency, amount } = extractAmountFromText(text);
  const tool = extractToolFromText(text, fileName);
  const description = extractDescriptionFromText(text, tool);

  return {
    suggestedDate: extractDateFromText(text, fileName),
    suggestedCurrency: currency,
    suggestedAmount: amount,
    suggestedTool: tool,
    suggestedDescription: description,
    textPreview: text.slice(0, 2400),
  };
}

export async function parseManualReceiptPdf(file: File): Promise<ManualReceiptParseResult> {
  const text = await extractPdfText(file);
  return parseManualReceiptText(text, file.name);
}
