#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Helpers for manual receipt imports shared by the dashboard bridge and report builder."""

from __future__ import annotations

import base64
import datetime as dt
import difflib
import hashlib
import io
import json
import re
from pathlib import Path

try:
    import pdfplumber
except ImportError:  # pragma: no cover - optional dependency in some local Python environments
    pdfplumber = None

try:
    from exchange_rate import fetch_historical_rate as _fetch_hist_rate
except ImportError:
    _fetch_hist_rate = None

BASE_DIR = Path(__file__).resolve().parent
MANUAL_RECEIPTS_PATH = BASE_DIR / "manual_receipts.json"
MANUAL_INVOICES_DIR = BASE_DIR / "manual_invoices"
DOCS_DATA_PATH = BASE_DIR / "docs" / "data.json"

DATE_PATTERNS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%d-%m-%Y",
    "%m/%d/%Y",
)

MONTH_NAME_TO_NUMBER = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
    "ינואר": 1,
    "פברואר": 2,
    "מרץ": 3,
    "אפריל": 4,
    "אפר": 4,
    "מאי": 5,
    "יוני": 6,
    "יולי": 7,
    "אוגוסט": 8,
    "אוג": 8,
    "ספטמבר": 9,
    "ספט": 9,
    "אוקטובר": 10,
    "אוק": 10,
    "נובמבר": 11,
    "נוב": 11,
    "דצמבר": 12,
    "דצמ": 12,
}

MONTH_PATTERN = "|".join(sorted((re.escape(name) for name in MONTH_NAME_TO_NUMBER), key=len, reverse=True))

TOOL_ALIASES = {
    "openai": "OpenAI",
    "chatgpt": "OpenAI",
    "anthropic": "Anthropic",
    "claude": "Anthropic",
    "google workspace": "Google Workspace",
    "workspace": "Google Workspace",
    "capcut": "CapCut",
    "eleven labs": "Eleven Labs",
    "elevenlabs": "Eleven Labs",
    "make": "Make",
    "manychat": "Manychat",
    "timeless": "Timeless",
    "lovable": "Lovable",
    "runway": "Runway ML",
    "replicate": "Replicate",
    "recraft": "Recraft",
    "ideogram": "Ideogram AI",
    "genspark": "Genspark",
    "meta": "Meta (Ads)",
    "facebook ads": "Meta (Ads)",
    "ionos": "IONOS",
    "manus": "Manus AI",
    "higgsfield": "Higgsfield",
    "astria": "Astria",
    "hedra": "Hedra",
    "dzine.ai": "Dzine",
    "dzine": "Dzine",
}

BLOCKED_DESCRIPTION_TOKENS = (
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
)


def ensure_manual_receipts_file():
    if not MANUAL_RECEIPTS_PATH.exists():
        MANUAL_RECEIPTS_PATH.write_text("[]\n", encoding="utf-8")


def load_manual_receipts():
    ensure_manual_receipts_file()
    return json.loads(MANUAL_RECEIPTS_PATH.read_text(encoding="utf-8"))


def save_manual_receipts(entries):
    ensure_manual_receipts_file()
    MANUAL_RECEIPTS_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def normalize_tool_name(tool: str) -> str:
    return re.sub(r"\s+", " ", tool.strip())


def normalize_description(description: str) -> str:
    return re.sub(r"\s+", " ", description.strip())


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "receipt"


def normalize_text_for_matching(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def receipt_identity(entry: dict):
    return (
        entry["date"],
        normalize_tool_name(entry["tool"]).casefold(),
        normalize_description(entry["description"]).casefold(),
        entry["currency"],
        round(float(entry["original_amount"]), 2),
    )


def load_existing_transaction_keys():
    keys = set()
    if not DOCS_DATA_PATH.exists():
        return keys

    try:
        payload = json.loads(DOCS_DATA_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return keys

    for transaction in payload.get("transactions", []):
        keys.add(
            (
                transaction.get("date", ""),
                normalize_tool_name(transaction.get("tool", "")).casefold(),
                normalize_description(transaction.get("description", "")).casefold(),
                transaction.get("currency", "USD"),
                round(float(transaction.get("original_amount", transaction.get("amount_usd", 0))), 2),
            )
        )
    return keys


def to_transaction_tuple(entry: dict):
    amount_ils = entry.get("amount_ils")
    if amount_ils is not None:
        # Pre-locked ILS — use directly so build_report never touches live rates.
        return (entry["date"], entry["tool"], entry["description"],
                round(float(amount_ils), 2), "ILS", "manual")
    return (
        entry["date"],
        entry["tool"],
        entry["description"],
        round(float(entry["original_amount"]), 2),
        entry["currency"],
        "manual",
    )


def parse_date_candidate(value: str) -> str | None:
    cleaned = value.strip()
    for pattern in DATE_PATTERNS:
        try:
            return dt.datetime.strptime(cleaned, pattern).date().isoformat()
        except ValueError:
            continue
    return None


def clean_month_token(value: str) -> str:
    return re.sub(r"[^A-Za-zא-ת]", "", value).strip().lower()


def resolve_month_number(month_token: str) -> int | None:
    cleaned = clean_month_token(month_token)
    if not cleaned:
        return None

    candidates = [cleaned]
    if len(cleaned) > 3 and cleaned[0] in {"ב", "ל", "מ", "ה", "ו", "כ", "ש"}:
        candidates.append(cleaned[1:])

    for candidate in candidates:
        month_number = MONTH_NAME_TO_NUMBER.get(candidate)
        if month_number:
            return month_number

    fuzzy_match = difflib.get_close_matches(cleaned, MONTH_NAME_TO_NUMBER.keys(), n=1, cutoff=0.72)
    if fuzzy_match:
        return MONTH_NAME_TO_NUMBER[fuzzy_match[0]]

    return None


def build_iso_date(day: str, month_token: str, year: str) -> str | None:
    month_number = resolve_month_number(month_token)
    if not month_number:
        return None

    try:
        return dt.date(int(year), month_number, int(day)).isoformat()
    except ValueError:
        return None


def extract_date_from_line(line: str) -> str | None:
    compact_line = normalize_text_for_matching(line)

    for match in re.finditer(r"\b\d{4}-\d{2}-\d{2}\b", compact_line):
        parsed = parse_date_candidate(match.group(0))
        if parsed:
            return parsed

    for match in re.finditer(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b", compact_line):
        parsed = parse_date_candidate(match.group(0))
        if parsed:
            return parsed

    month_patterns = [
        rf"\b(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<month>{MONTH_PATTERN})\s+(?P<year>\d{{4}})\b",
        rf"\b(?P<month>{MONTH_PATTERN})\s+(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*(?P<year>\d{{4}})\b",
        rf"\b(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\s+(?P<year>\d{{4}})\s+(?P<month>{MONTH_PATTERN})\b",
        rf"\b(?P<month>{MONTH_PATTERN})\s+(?P<year>\d{{4}})\s+(?P<day>\d{{1,2}})(?:st|nd|rd|th)?\b",
    ]

    for pattern in month_patterns:
        match = re.search(pattern, compact_line, re.IGNORECASE)
        if not match:
            continue
        parsed = build_iso_date(match.group("day"), match.group("month"), match.group("year"))
        if parsed:
            return parsed

    tokens = re.findall(r"[A-Za-zà-ú]+|\d{1,4}", compact_line)
    for index, token in enumerate(tokens):
        month_number = resolve_month_number(token)
        if not month_number:
            continue

        nearby_numbers = [
            candidate
            for candidate in tokens[max(0, index - 2): min(len(tokens), index + 3)]
            if candidate.isdigit()
        ]
        day = next((value for value in nearby_numbers if len(value) <= 2 and 1 <= int(value) <= 31), None)
        year = next((value for value in nearby_numbers if len(value) == 4 and 2000 <= int(value) <= 2100), None)
        if not (day and year):
            continue

        try:
            return dt.date(int(year), month_number, int(day)).isoformat()
        except ValueError:
            continue

    return None


def extract_date_from_text(text: str) -> str | None:
    for line in text.splitlines():
        parsed = extract_date_from_line(line)
        if parsed:
            return parsed

    return extract_date_from_line(text)


def _amount_candidates(pattern: str, text: str):
    for match in re.finditer(pattern, text, re.IGNORECASE):
        raw = match.group(1).replace(",", "").strip()
        try:
            yield float(raw)
        except ValueError:
            continue


def extract_labeled_amount(text: str):
    lines = [normalize_text_for_matching(line) for line in text.splitlines()]
    labeled_patterns = [
        ("USD", r"(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|\$)"),
        ("USD", r"(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*(?:USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)"),
        ("ILS", r"(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₪|ILS|NIS)"),
        ("ILS", r"(?:\bamount paid\b|\bpaid on\b|\bpaid\b|\btotal\b)\D*(?:₪|ILS|NIS)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)"),
    ]

    for line in lines:
        lowered = line.casefold()
        if "subtotal" in lowered:
            continue
        if not re.search(r"\b(amount paid|paid on|paid|total)\b", lowered):
            continue

        for currency, pattern in labeled_patterns:
            matches = list(_amount_candidates(pattern, line))
            if matches:
                return {"currency": currency, "amount": round(matches[-1], 2)}

    return None


def extract_amount_from_text(text: str):
    labeled_amount = extract_labeled_amount(text)
    if labeled_amount:
        return labeled_amount

    ils_candidates = list(
        _amount_candidates(r"(?:₪|ILS|NIS)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text)
    )
    ils_candidates.extend(
        _amount_candidates(r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₪|ILS|NIS)", text)
    )

    usd_candidates = list(
        _amount_candidates(r"(?:USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text)
    )
    usd_candidates.extend(
        _amount_candidates(r"([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:USD|\$)", text)
    )

    if usd_candidates:
        return {"currency": "USD", "amount": round(max(usd_candidates), 2)}

    if ils_candidates:
        return {"currency": "ILS", "amount": round(max(ils_candidates), 2)}

    generic_candidates = list(_amount_candidates(r"\b([0-9][0-9,]*\.[0-9]{2})\b", text))
    if generic_candidates:
        return {"currency": None, "amount": round(max(generic_candidates), 2)}

    return {"currency": None, "amount": None}


def extract_tool_from_text(text: str, file_name: str | None = None) -> str | None:
    haystack = f"{text}\n{file_name or ''}".casefold()
    for alias, tool_name in sorted(TOOL_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        if alias.casefold() in haystack:
            return tool_name
    return None


def clean_description_candidate(value: str) -> str:
    candidate = normalize_text_for_matching(value)
    candidate = re.sub(r"^description\b[:\s]*", "", candidate, flags=re.IGNORECASE)
    candidate = re.sub(
        r"(?:\s+(?:[0-9]+\.[0-9]{1,2}\s*(?:USD|\$|₪|ILS|NIS)?|[0-9]+\s*(?:USD|\$|₪|ILS|NIS)))+\s*$",
        "",
        candidate,
        flags=re.IGNORECASE,
    )
    candidate = re.sub(r"\s+this is (?:an?\s+)?receipt\b.*$", "", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"\s+not a tax invoice\b.*$", "", candidate, flags=re.IGNORECASE)
    candidate = re.sub(r"\s+(?:Qty|Unit price|Amount)\b.*$", "", candidate, flags=re.IGNORECASE)
    return candidate.strip(" -:")


def is_amount_only_line(value: str) -> bool:
    return bool(
        re.fullmatch(
            r"(?:USD|\$|ג‚×|ILS|NIS)?\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?(?:\s*(?:USD|\$|ג‚×|ILS|NIS))?",
            normalize_text_for_matching(value),
            flags=re.IGNORECASE,
        )
    )


def is_description_heading(value: str) -> bool:
    return bool(re.fullmatch(r"description\b[:\s]*", normalize_text_for_matching(value), flags=re.IGNORECASE))


def starts_with_description_heading(value: str) -> bool:
    return bool(re.match(r"description\b", normalize_text_for_matching(value), flags=re.IGNORECASE))


def is_amount_heading(value: str) -> bool:
    return bool(
        re.fullmatch(
            r"amount(?:\s+in\s*\([^)]+\))?[:\s]*",
            normalize_text_for_matching(value),
            flags=re.IGNORECASE,
        )
    )


def extract_description_from_text(text: str, tool: str | None = None) -> str | None:
    lines = [normalize_text_for_matching(line) for line in text.splitlines()]

    for index, line in enumerate(lines):
        if not starts_with_description_heading(line):
            continue

        inline_candidate = clean_description_candidate(line)
        if inline_candidate and not is_amount_heading(inline_candidate) and not is_amount_only_line(inline_candidate):
            return inline_candidate

        for next_line in lines[index + 1:index + 5]:
            if not next_line or is_amount_heading(next_line) or is_amount_only_line(next_line):
                continue

            candidate = clean_description_candidate(next_line)
            if candidate:
                return candidate

    for line in lines:
        if not line or len(line) < 4:
            continue

        lowered = line.casefold()
        if any(token in lowered for token in BLOCKED_DESCRIPTION_TOKENS):
            continue
        if is_description_heading(line) or is_amount_heading(line) or is_amount_only_line(line):
            continue
        if tool and tool.casefold() not in lowered:
            continue
        if not re.search(r"[A-Za-zא-ת]", line):
            continue
        if not re.search(r"\d+(?:\.\d{1,2})?\s*(?:USD|\$|₪|ILS|NIS)", line, re.IGNORECASE):
            continue

        candidate = clean_description_candidate(line)
        if candidate:
            return candidate

    return tool


def extract_pdf_text(pdf_bytes: bytes):
    if pdfplumber is None:
        raise RuntimeError("PDF parsing is unavailable because pdfplumber is not installed in this Python environment.")
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()


def extract_pdf_suggestions(pdf_bytes: bytes, file_name: str | None = None):
    text = extract_pdf_text(pdf_bytes)
    amount = extract_amount_from_text(text)
    tool = extract_tool_from_text(text, file_name)
    description = extract_description_from_text(text, tool)
    combined_date_context = text if not file_name else f"{text}\n{file_name}"
    return {
        "suggestedDate": extract_date_from_text(combined_date_context),
        "suggestedCurrency": amount["currency"],
        "suggestedAmount": amount["amount"],
        "suggestedTool": tool,
        "suggestedDescription": description,
        "textPreview": text[:2400],
    }


def decode_data_url(data_url: str) -> bytes:
    _, _, encoded = data_url.partition(",")
    return base64.b64decode(encoded if encoded else data_url)


def normalize_manual_receipt(entry: dict):
    tool = normalize_tool_name(str(entry.get("tool", "")))
    description = normalize_description(str(entry.get("description", "")))
    date = str(entry.get("date", "")).strip()
    currency = str(entry.get("currency", "USD")).strip().upper()
    original_amount = round(float(entry.get("original_amount", 0)), 2)
    notes = normalize_description(str(entry.get("notes", ""))) if entry.get("notes") else ""
    attachment_path = str(entry.get("attachment_path", "")).strip() or None
    attachment_name = str(entry.get("attachment_name", "")).strip() or None
    entry_mode = str(entry.get("entry_mode", "manual-form")).strip() or "manual-form"

    if not tool:
        raise ValueError("Tool name is required.")
    if not description:
        raise ValueError("Description is required.")
    if not parse_date_candidate(date):
        raise ValueError("A valid invoice date is required.")
    if currency not in {"USD", "ILS"}:
        raise ValueError("Currency must be USD or ILS.")
    if original_amount <= 0:
        raise ValueError("Amount must be greater than zero.")

    fingerprint = hashlib.sha1(
        f"{date}|{tool}|{description}|{currency}|{original_amount:.2f}".encode("utf-8")
    ).hexdigest()[:10]

    # Lock ILS at charge-date rate on first import; never re-computed from future live rates.
    if currency == "ILS":
        amount_ils = original_amount
    elif entry.get("amount_ils") is not None:
        amount_ils = round(float(entry["amount_ils"]), 2)
    elif _fetch_hist_rate is not None:
        amount_ils = round(original_amount * _fetch_hist_rate(date), 2)
    else:
        amount_ils = None

    return {
        "id": entry.get("id") or f"manual-{date}-{slugify(tool)}-{fingerprint}",
        "date": date,
        "tool": tool,
        "description": description,
        "currency": currency,
        "original_amount": original_amount,
        "amount_ils": amount_ils,
        "attachment_path": attachment_path,
        "attachment_name": attachment_name,
        "entry_mode": entry_mode,
        "notes": notes or None,
        "created_at": entry.get("created_at") or dt.datetime.now().isoformat(timespec="seconds"),
        "entry_source": "manual",
    }


def archive_manual_invoice(entry: dict, pdf_bytes: bytes | None, original_name: str | None):
    if not pdf_bytes:
        return None

    MANUAL_INVOICES_DIR.mkdir(exist_ok=True)
    safe_name = slugify(entry["tool"])
    original_suffix = Path(original_name or "receipt.pdf").suffix or ".pdf"
    target_name = f"{entry['date']}-{safe_name}-{entry['id']}{original_suffix.lower()}"
    target_path = MANUAL_INVOICES_DIR / target_name
    target_path.write_bytes(pdf_bytes)
    return target_path.relative_to(BASE_DIR).as_posix()
