#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
auto_invoice.py — Automatic AI Tool Invoice Scanner
----------------------------------------------------
Scans Gmail for new invoices → extracts amounts → updates build_report.py
→ rebuilds Excel → commits + pushes to GitHub.

First run: opens browser for Gmail authorization (one-time).
After that: fully silent, runs as scheduled task.
"""

import os, io, json, re, base64, subprocess, datetime, logging, time
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import pdfplumber
import requests

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR       = Path(r"C:\Users\roita\מעקב הוצאות כלים")
REPORT_PY      = BASE_DIR / "build_report.py"
INVOICES_DIR   = BASE_DIR / "invoices"
PROCESSED_JSON = BASE_DIR / "processed_messages.json"
CREDS_JSON     = BASE_DIR / "gmail_credentials.json"
TOKEN_JSON     = BASE_DIR / "gmail_token.json"
LOG_FILE       = BASE_DIR / "auto_invoice.log"

SCOPES        = ["https://www.googleapis.com/auth/gmail.readonly"]
EXCHANGE_RATE = 3.65   # ILS → USD  (matches הגדרות sheet B4)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Tool detection rules ──────────────────────────────────────────────────────
# Each rule: sender pattern → (tool_name, currency, source)
# source: 'pdf' | 'body' | 'web'
TOOL_RULES = [
    ("payments-noreply@google.com",  "Google Workspace", "ILS", "pdf"),
    ("noreply@email.capcut.com",     "CapCut",           "ILS", "web"),
    ("billing@anthropic.com",        "Anthropic",        "USD", "body"),
    ("invoice+statements@mail.anthropic.com", "Anthropic", "USD", "body"),
    ("info@elevenlabs.io",           "Eleven Labs",      "USD", "pdf"),
    ("noreply@elevenlabs.io",        "Eleven Labs",      "USD", "pdf"),
    ("acct_1M07hSLmdOdiMXBs@stripe.com", "Eleven Labs",  "USD", "body"),
    ("noreply@runwayml.com",         "Runway ML",        "USD", "body"),
    ("billing@make.com",             "Make",             "USD", "body"),
    ("billing@manychat.com",         "Manychat",         "USD", "body"),
    ("support@higgsfield.ai",        "Higgsfield",       "USD", "pdf"),
    ("billing@replicate.com",        "Replicate",        "USD", "body"),
    ("billing@recraft.ai",           "Recraft",          "USD", "body"),
    ("billing@ideogram.ai",          "Ideogram AI",      "USD", "body"),
    ("noreply@genspark.ai",          "Genspark",         "USD", "body"),
]

# ── Gmail helpers ─────────────────────────────────────────────────────────────

def get_service():
    creds = None
    if TOKEN_JSON.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_JSON), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDS_JSON.exists():
                raise FileNotFoundError(
                    f"\n\n❌  gmail_credentials.json לא נמצא!\n"
                    f"   → עקוב אחרי SETUP.md כדי להוריד את הקובץ מ-Google Cloud Console.\n"
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_JSON), SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_JSON.write_text(creds.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=creds)


def search_messages(service, days=90):
    """Return all message IDs from the חשבוניות label in the last N days."""
    query = f"newer_than:{days}d"
    # Try label first, fall back to broad search
    for q in [f"label:חשבוניות {query}", query]:
        try:
            resp = service.users().messages().list(
                userId="me", q=q, maxResults=100
            ).execute()
            msgs = resp.get("messages", [])
            if msgs:
                return msgs
        except Exception as e:
            log.warning(f"Search query '{q}' failed: {e}")
    return []


def get_full_message(service, msg_id):
    return service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()


def get_attachment_bytes(service, msg_id, att_id):
    att = service.users().messages().attachments().get(
        userId="me", messageId=msg_id, id=att_id
    ).execute()
    return base64.urlsafe_b64decode(att["data"])


def get_headers(msg):
    return {h["name"].lower(): h["value"]
            for h in msg["payload"]["headers"]}


def get_body_text(payload):
    """Recursively extract plain text from message payload."""
    if payload.get("mimeType") == "text/plain" and "data" in payload.get("body", {}):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    text = ""
    for part in payload.get("parts", []):
        text += get_body_text(part)
    return text


def get_pdf_parts(payload):
    """Recursively find all PDF attachment parts."""
    parts = []
    if payload.get("mimeType") == "application/pdf" and payload.get("filename"):
        parts.append(payload)
    for p in payload.get("parts", []):
        parts.extend(get_pdf_parts(p))
    return parts


# ── Amount extraction ─────────────────────────────────────────────────────────

def extract_pdf_text(pdf_bytes):
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return "\n".join(p.extract_text() or "" for p in pdf.pages)


def find_amount(text, currency):
    """Extract first numeric amount matching the currency sign."""
    if currency == "ILS":
        # ₪56.93  or  56.93 ILS
        for pat in [r"₪\s*([\d,]+\.?\d*)", r"([\d,]+\.?\d*)\s*ILS"]:
            m = re.search(pat, text)
            if m:
                return float(m.group(1).replace(",", ""))
    else:
        # $20.00  or  USD 20.00
        for pat in [r"\$([\d,]+\.?\d*)", r"USD\s*([\d,]+\.?\d*)"]:
            m = re.search(pat, text)
            if m:
                return float(m.group(1).replace(",", ""))
    return None


def fetch_capcut_amount(body_text):
    """Extract amount from CapCut's web invoice link."""
    url_m = re.search(r"https://f-p\.sgsnssdk\.com/pipo_fe/invoice/preview\?[^\s]+", body_text)
    if not url_m:
        return None
    try:
        resp = requests.get(url_m.group(0), timeout=15)
        m = re.search(r"([\d.]+)\s*ILS", resp.text)
        if m:
            return float(m.group(1))
    except Exception as e:
        log.warning(f"CapCut web fetch failed: {e}")
    return None


# ── Message processing ────────────────────────────────────────────────────────

def identify_tool(headers):
    sender = headers.get("from", "").lower()
    for pattern, tool, currency, source in TOOL_RULES:
        if pattern in sender:
            return tool, currency, source
    return None, None, None


def parse_date(headers):
    date_str = headers.get("date", "")
    for fmt in [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S +0000 (UTC)",
    ]:
        try:
            raw = re.sub(r"\s*\(.*?\)\s*$", "", date_str.strip())
            return datetime.datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    log.warning(f"Could not parse date: {date_str!r}")
    return datetime.date.today()


def process_message(service, msg_id):
    """
    Returns dict with {date, tool, description, amount_usd, pdf_bytes, pdf_name}
    or None if amount could not be determined.
    """
    msg     = get_full_message(service, msg_id)
    headers = get_headers(msg)
    tool, currency, source = identify_tool(headers)

    if not tool:
        log.info(f"  Skipping {msg_id} — unknown sender: {headers.get('from','?')}")
        return None

    date = parse_date(headers)
    log.info(f"  {tool} | {date} | source={source}")

    amount_raw = None
    pdf_bytes  = None
    pdf_name   = None

    if source == "pdf":
        for part in get_pdf_parts(msg["payload"]):
            att_id = part["body"].get("attachmentId")
            if not att_id:
                continue
            pdf_bytes = get_attachment_bytes(service, msg_id, att_id)
            pdf_name  = part["filename"]
            text      = extract_pdf_text(pdf_bytes)
            amount_raw = find_amount(text, currency)
            if amount_raw:
                break

    elif source == "web":
        body = get_body_text(msg["payload"])
        amount_raw = fetch_capcut_amount(body)

    elif source == "body":
        body = get_body_text(msg["payload"])
        amount_raw = find_amount(body, currency)

    if amount_raw is None:
        log.warning(f"  Could not extract amount for {tool} ({msg_id})")
        return None

    # Convert ILS → USD
    if currency == "ILS":
        amount_usd = round(amount_raw / EXCHANGE_RATE, 2)
        description = f"{tool} (₪{amount_raw})"
    else:
        amount_usd  = amount_raw
        description = tool

    return {
        "date":        date.strftime("%Y-%m-%d"),
        "tool":        tool,
        "description": description,
        "amount_usd":  amount_usd,
        "pdf_bytes":   pdf_bytes,
        "pdf_name":    pdf_name,
    }


# ── build_report.py insertion ─────────────────────────────────────────────────

def already_imported(date_str, tool):
    """True if an entry with the same date+tool exists in TRANSACTIONS."""
    code = REPORT_PY.read_text(encoding="utf-8")
    # Accept partial date match (YYYY-MM) for monthly tools
    ym   = date_str[:7]
    full = re.search(rf'"{re.escape(date_str)}".*?"{re.escape(tool)}"', code)
    approx = re.search(rf'"{ym}-\d{{2}}".*?"{re.escape(tool)}"', code)
    return bool(full or approx)


def insert_transaction(txn):
    """Insert new line into TRANSACTIONS sorted by date."""
    code   = REPORT_PY.read_text(encoding="utf-8")
    lines  = code.splitlines(keepends=True)
    ym     = txn["date"][:7]
    new_ln = (f'    ("{txn["date"]}", "{txn["tool"]}", '
              f'"{txn["description"]}", {txn["amount_usd"]:.2f}),\n')

    in_tx      = False
    insert_at  = None
    last_month = None

    for i, line in enumerate(lines):
        if "TRANSACTIONS = [" in line:
            in_tx = True
            continue
        if not in_tx:
            continue
        stripped = line.strip()
        if stripped == "]":
            insert_at = i
            break
        m = re.match(r'\s*\("(\d{4}-\d{2}-\d{2})"', line)
        if m:
            entry_ym = m.group(1)[:7]
            if entry_ym == ym:
                last_month = i
            elif entry_ym > ym and insert_at is None:
                insert_at = i

    if insert_at is None and last_month is not None:
        insert_at = last_month + 1

    if insert_at is None:
        log.error("Could not find insertion point in TRANSACTIONS")
        return False

    lines.insert(insert_at, new_ln)
    REPORT_PY.write_text("".join(lines), encoding="utf-8")
    log.info(f"  Inserted: {new_ln.strip()}")
    return True


# ── Git helpers ───────────────────────────────────────────────────────────────

def git(*args):
    subprocess.run(["git", *args], cwd=str(BASE_DIR),
                   capture_output=True, text=True)


def rebuild_and_push(new_txns):
    log.info("Rebuilding Excel...")
    r = subprocess.run(
        ["python", str(REPORT_PY)],
        cwd=str(BASE_DIR), capture_output=True, text=True
    )
    if r.returncode != 0:
        log.error(f"Build failed:\n{r.stderr}")
        return

    summary = ", ".join(f"{t['tool']} {t['date']}" for t in new_txns)
    git("add", "build_report.py", "AI_Tools_Expenses_2025_2026.xlsx")
    git("add", "invoices/")
    git("commit", "-m", f"Auto: add invoices – {summary}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>")
    git("push", "origin", "master:main")
    log.info(f"Pushed: {summary}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("auto_invoice scan started")
    INVOICES_DIR.mkdir(exist_ok=True)

    service   = get_service()
    processed = set(json.loads(PROCESSED_JSON.read_text(encoding="utf-8"))
                    if PROCESSED_JSON.exists() else [])

    messages = search_messages(service, days=90)
    log.info(f"Found {len(messages)} messages (last 90 days)")

    new_txns = []

    for m in messages:
        mid = m["id"]
        if mid in processed:
            continue

        log.info(f"Processing {mid}")
        try:
            txn = process_message(service, mid)
        except Exception as e:
            log.error(f"  Error on {mid}: {e}")
            processed.add(mid)
            continue

        processed.add(mid)

        if txn is None:
            continue

        if already_imported(txn["date"], txn["tool"]):
            log.info(f"  Already exists: {txn['tool']} {txn['date']}")
            continue

        # Save PDF
        if txn["pdf_bytes"] and txn["pdf_name"]:
            (INVOICES_DIR / txn["pdf_name"]).write_bytes(txn["pdf_bytes"])
            log.info(f"  Saved PDF: {txn['pdf_name']}")

        if insert_transaction(txn):
            new_txns.append(txn)

    # Save processed list
    PROCESSED_JSON.write_text(
        json.dumps(sorted(processed), indent=2), encoding="utf-8"
    )

    if new_txns:
        log.info(f"Added {len(new_txns)} new transactions → rebuilding")
        rebuild_and_push(new_txns)
        print(f"✅  {len(new_txns)} חשבוניות חדשות נוספו אוטומטית:")
        for t in new_txns:
            print(f"   • {t['tool']}  {t['date']}  ${t['amount_usd']}")
    else:
        log.info("No new transactions")
        print("✅  אין חשבוניות חדשות")

    log.info("Done")


if __name__ == "__main__":
    main()
