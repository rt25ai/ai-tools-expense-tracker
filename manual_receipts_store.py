#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Helpers for manual receipt imports shared by the dashboard bridge and report builder."""

from __future__ import annotations

import base64
import datetime as dt
import hashlib
import io
import json
import re
from pathlib import Path

try:
    import pdfplumber
except ImportError:  # pragma: no cover - optional dependency in some local Python environments
    pdfplumber = None

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
    value = re.sub(r"\s+", " ", tool.strip())
    return value


def normalize_description(description: str) -> str:
    value = re.sub(r"\s+", " ", description.strip())
    return value


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "receipt"


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


def extract_date_from_text(text: str) -> str | None:
    for match in re.finditer(r"\b\d{4}-\d{2}-\d{2}\b", text):
        parsed = parse_date_candidate(match.group(0))
        if parsed:
            return parsed

    for match in re.finditer(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b", text):
        parsed = parse_date_candidate(match.group(0))
        if parsed:
            return parsed

    return None


def _amount_candidates(pattern: str, text: str):
    for match in re.finditer(pattern, text, re.IGNORECASE):
        raw = match.group(1).replace(",", "").strip()
        try:
            yield float(raw)
        except ValueError:
            continue


def extract_amount_from_text(text: str):
    ils_candidates = list(
        _amount_candidates(r"(?:₪|ILS|NIS)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text)
    )
    usd_candidates = list(
        _amount_candidates(r"(?:USD|\$)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", text)
    )

    if ils_candidates:
        return {
            "currency": "ILS",
            "amount": round(max(ils_candidates), 2),
        }

    if usd_candidates:
        return {
            "currency": "USD",
            "amount": round(max(usd_candidates), 2),
        }

    generic_candidates = list(_amount_candidates(r"\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b", text))
    if generic_candidates:
        return {
            "currency": None,
            "amount": round(max(generic_candidates), 2),
        }

    return {
        "currency": None,
        "amount": None,
    }


def extract_pdf_text(pdf_bytes: bytes):
    if pdfplumber is None:
        raise RuntimeError("PDF parsing is unavailable because pdfplumber is not installed in this Python environment.")
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages).strip()


def extract_pdf_suggestions(pdf_bytes: bytes):
    text = extract_pdf_text(pdf_bytes)
    amount = extract_amount_from_text(text)
    return {
        "suggestedDate": extract_date_from_text(text),
        "suggestedCurrency": amount["currency"],
        "suggestedAmount": amount["amount"],
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

    return {
        "id": entry.get("id") or f"manual-{date}-{slugify(tool)}-{fingerprint}",
        "date": date,
        "tool": tool,
        "description": description,
        "currency": currency,
        "original_amount": original_amount,
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
