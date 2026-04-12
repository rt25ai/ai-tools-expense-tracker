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
from exchange_rate import FALLBACK_USD_ILS_RATE, fetch_usd_to_ils_rate

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).resolve().parent
REPORT_PY      = BASE_DIR / "build_report.py"
INVOICES_DIR   = BASE_DIR / "invoices"
PROCESSED_JSON = BASE_DIR / "processed_messages.json"
CREDS_JSON     = BASE_DIR / "gmail_credentials.json"
TOKEN_JSON     = BASE_DIR / "gmail_token.json"
LOG_FILE       = BASE_DIR / "auto_invoice.log"
STATUS_JSON    = BASE_DIR / "auto_invoice_status.json"

SCOPES        = ["https://www.googleapis.com/auth/gmail.readonly"]
EXCHANGE_RATE = FALLBACK_USD_ILS_RATE

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)
_EXCHANGE_RATE_CACHE = None


def get_exchange_rate():
    global _EXCHANGE_RATE_CACHE
    if _EXCHANGE_RATE_CACHE is None:
        rate, _, _ = fetch_usd_to_ils_rate()
        _EXCHANGE_RATE_CACHE = rate
    return _EXCHANGE_RATE_CACHE

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
    ("receipts@openai.com",          "OpenAI",           "USD", "body"),
    ("noreply@tm.openai.com",        "OpenAI",           "USD", "body"),
    ("openai",                       "OpenAI",           "USD", "body"),
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
    """Return a deduplicated message list from the invoices label, inbox, and recent mail."""
    queries = [
        f"label:חשבוניות newer_than:{days}d",
        f"in:inbox newer_than:{days}d",
        f"newer_than:{days}d",
    ]
    messages_by_id = {}

    for q in queries:
        page_token = None
        while True:
            try:
                resp = service.users().messages().list(
                    userId="me",
                    q=q,
                    maxResults=100,
                    pageToken=page_token,
                ).execute()
            except Exception as e:
                log.warning(f"Search query '{q}' failed: {e}")
                break

            for msg in resp.get("messages", []):
                messages_by_id[msg["id"]] = msg

            page_token = resp.get("nextPageToken")
            if not page_token:
                break

    return list(messages_by_id.values())


def load_processed_state():
    if not PROCESSED_JSON.exists():
        return {"message_ids": set(), "invoice_keys": set()}

    payload = json.loads(PROCESSED_JSON.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return {"message_ids": set(payload), "invoice_keys": set()}

    return {
        "message_ids": set(payload.get("message_ids", [])),
        "invoice_keys": set(payload.get("invoice_keys", [])),
    }


def save_processed_state(message_ids, invoice_keys):
    PROCESSED_JSON.write_text(
        json.dumps(
            {
                "message_ids": sorted(message_ids),
                "invoice_keys": sorted(invoice_keys),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


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
    """Recursively extract text from message payload. Prefers text/plain; falls back to text/html."""
    if payload.get("mimeType") == "text/plain" and "data" in payload.get("body", {}):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    text = ""
    for part in payload.get("parts", []):
        text += get_body_text(part)
    if not text and payload.get("mimeType") == "text/html" and "data" in payload.get("body", {}):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    return text


def get_pdf_parts(payload):
    """Recursively find all PDF attachment parts."""
    parts = []
    if payload.get("mimeType") == "application/pdf" and payload.get("filename"):
        parts.append(payload)
    for p in payload.get("parts", []):
        parts.extend(get_pdf_parts(p))
    return parts


def is_meta_final_receipt(headers, body_text):
    """Identify only final Meta charges, not billing-threshold/intermediate notices."""
    subject = headers.get("subject", "").lower()
    body    = body_text.lower()

    final_markers = [
        "receipt for your payment to meta platforms, inc.",
        "you successfully sent a payment",
        "you paid",
        "transaction id",
        "meta platforms, inc.",
    ]
    blocked_markers = [
        "not a final bill",
        "this is not a final bill",
        "this is not a bill",
        "billing threshold",
        "amount due",
    ]

    if any(marker in subject or marker in body for marker in blocked_markers):
        return False

    return all(marker in body or marker in subject for marker in final_markers)


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


CAPCUT_FALLBACK_ILS = 49.90  # Monthly subscription price; update if CapCut changes pricing.


def fetch_capcut_amount(body_text):
    """Extract amount from CapCut's web invoice link.

    CapCut's invoice preview page is a JS SPA that requires an authenticated browser
    session — the static fetch always returns PAY000.  The email body also contains no
    amount, so we fall back to the known fixed monthly price.
    """
    url_m = re.search(r"https://f-p\.sgsnssdk\.com/pipo_fe/invoice/preview\?[^\s\"<>]+", body_text)
    if url_m:
        try:
            resp = requests.get(url_m.group(0), timeout=15)
            m = re.search(r"([\d.]+)\s*ILS", resp.text)
            if m:
                return float(m.group(1))
        except Exception as e:
            log.warning(f"CapCut web fetch failed: {e}")
    if url_m:  # URL was found but amount extraction failed → use known price
        log.warning(
            f"CapCut invoice page returned no amount (SPA requires browser session). "
            f"Using fallback price: {CAPCUT_FALLBACK_ILS} ILS. "
            f"Update CAPCUT_FALLBACK_ILS in auto_invoice.py if pricing changes."
        )
        return CAPCUT_FALLBACK_ILS
    return None


def find_meta_paid_amount(text):
    """Extract the final paid amount from a PayPal Meta receipt."""
    for pat in [
        r"You paid\s*[^\d$]*\$([\d,]+\.?\d*)\s*USD\s*to Meta Platforms, Inc\.",
        r"\*Payment\*\s*[^\d$]*\$([\d,]+\.?\d*)\s*USD",
        r"\*Total\*\s*[^\d$]*\$([\d,]+\.?\d*)\s*USD",
    ]:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            return float(m.group(1).replace(",", ""))
    return None


# ── Message processing ────────────────────────────────────────────────────────

def identify_tool(headers, payload):
    body = get_body_text(payload)

    # Meta gets imported only from final PayPal payment receipts.
    if is_meta_final_receipt(headers, body):
        return "Meta (Ads)", "USD", "body"

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


def build_invoice_key(headers, txn):
    message_header_id = headers.get("message-id", "").strip().lower()
    if message_header_id:
        return f"msgid:{message_header_id}"

    return "|".join(
        [
            txn["tool"],
            txn["date"],
            txn["currency"],
            f'{txn["original_amount"]:.2f}',
            txn["description"],
        ]
    )


def process_message(service, msg_id):
    """
    Returns dict with {date, tool, description, amount_usd, pdf_bytes, pdf_name}
    or None if amount could not be determined.
    """
    msg     = get_full_message(service, msg_id)
    headers = get_headers(msg)
    body    = get_body_text(msg["payload"])
    tool, currency, source = identify_tool(headers, msg["payload"])

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
        amount_raw = fetch_capcut_amount(body)

    elif source == "body":
        if tool == "Meta (Ads)":
            amount_raw = find_meta_paid_amount(body)
        if amount_raw is None:
            amount_raw = find_amount(body, currency)

    if amount_raw is None:
        log.warning(f"  Could not extract amount for {tool} ({msg_id})")
        return None

    # Keep exact ILS amounts for local-currency receipts and convert only for USD-based bookkeeping.
    if currency == "ILS":
        original_amount = round(amount_raw, 2)
        amount_usd = round(amount_raw / get_exchange_rate(), 6)
        description = f"{tool} (₪{amount_raw})"
    else:
        original_amount = round(amount_raw, 2)
        amount_usd  = amount_raw
        if tool == "OpenAI":
            description = "ChatGPT Plus"
        elif tool == "Meta (Ads)":
            description = "Facebook Ads"
        else:
            description = tool

    txn = {
        "date":        date.strftime("%Y-%m-%d"),
        "tool":        tool,
        "description": description,
        "currency":    currency,
        "original_amount": original_amount,
        "amount_usd":  amount_usd,
        "pdf_bytes":   pdf_bytes,
        "pdf_name":    pdf_name,
    }
    txn["invoice_key"] = build_invoice_key(headers, txn)
    return txn


# ── build_report.py insertion ─────────────────────────────────────────────────

def already_imported(txn):
    """True if the exact transaction line already exists in MANUAL_TRANSACTIONS."""
    code = REPORT_PY.read_text(encoding="utf-8")
    if txn["currency"] == "ILS":
        exact = (f'("{txn["date"]}", "{txn["tool"]}", '
                 f'"{txn["description"]}", {txn["original_amount"]:.2f}, "ILS")')
    else:
        exact = (f'("{txn["date"]}", "{txn["tool"]}", '
                 f'"{txn["description"]}", {txn["amount_usd"]:.2f})')
    return exact in code


def insert_transaction(txn):
    """Insert new line into MANUAL_TRANSACTIONS sorted by date."""
    code   = REPORT_PY.read_text(encoding="utf-8")
    lines  = code.splitlines(keepends=True)
    if txn["currency"] == "ILS":
        new_ln = (f'    ("{txn["date"]}", "{txn["tool"]}", '
                  f'"{txn["description"]}", {txn["original_amount"]:.2f}, "ILS"),\n')
    else:
        new_ln = (f'    ("{txn["date"]}", "{txn["tool"]}", '
                  f'"{txn["description"]}", {txn["amount_usd"]:.2f}),\n')

    in_tx     = False
    insert_at = None

    for i, line in enumerate(lines):
        if "MANUAL_TRANSACTIONS = [" in line:
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
            entry_date = m.group(1)
            if entry_date > txn["date"]:
                insert_at = i
                break

    if insert_at is None:
        log.error("Could not find insertion point in MANUAL_TRANSACTIONS")
        return False

    lines.insert(insert_at, new_ln)
    REPORT_PY.write_text("".join(lines), encoding="utf-8")
    log.info(f"  Inserted: {new_ln.strip()}")
    return True


def write_status(new_txns, error=None):
    """Write run status to auto_invoice_status.json for the dashboard."""
    now = datetime.datetime.now()
    next_run = (now + datetime.timedelta(days=1)).replace(
        hour=8, minute=0, second=0, microsecond=0
    )
    status = {
        "last_run": now.strftime("%Y-%m-%dT%H:%M:%S"),
        "next_run": next_run.strftime("%Y-%m-%dT%H:%M:%S"),
        "result": "error" if error else ("found" if new_txns else "ok"),
        "new_count": len(new_txns),
        "new_tools": [f"{t['tool']} {t['date']}" for t in new_txns],
        "error": str(error) if error else None,
    }
    STATUS_JSON.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")


# ── Git helpers ───────────────────────────────────────────────────────────────

def git(*args):
    r = subprocess.run(["git", *args], cwd=str(BASE_DIR),
                       capture_output=True, text=True)
    if r.returncode != 0:
        log.warning(f"git {' '.join(args)} failed (rc={r.returncode}): {r.stderr.strip()}")


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
    git("add", "docs/data.json")   # ← update live dashboard
    git("add", "auto_invoice_status.json")
    git("add", "processed_messages.json")
    git("commit", "-m", f"Auto: add invoices – {summary}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>")
    git("push", "origin", "HEAD:master")  # ← GitHub Pages builds from master
    git("push", "origin", "HEAD:main")    # ← keep main in sync
    log.info(f"Pushed: {summary}")


def push_status_only():
    """Commit and push the status file even when no new invoices were found."""
    git("add", "auto_invoice_status.json")
    git("add", "processed_messages.json")
    r = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=str(BASE_DIR), capture_output=True
    )
    if r.returncode != 0:  # something staged → commit
        git("commit", "-m", "Auto: Gmail scan – no new invoices\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>")
        git("push", "origin", "HEAD:master")
        git("push", "origin", "HEAD:main")
        log.info("Pushed status update (no new invoices)")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("auto_invoice scan started")
    INVOICES_DIR.mkdir(exist_ok=True)

    # Sync with remote before scanning to avoid conflicts when both local and CI run
    git("pull", "--rebase", "origin", "master")

    service = get_service()
    processed_state = load_processed_state()
    processed_ids = processed_state["message_ids"]
    processed_invoice_keys = processed_state["invoice_keys"]

    messages = search_messages(service, days=90)
    log.info(f"Found {len(messages)} messages (last 90 days)")

    new_txns = []

    for m in messages:
        mid = m["id"]
        if mid in processed_ids:
            continue

        log.info(f"Processing {mid}")
        try:
            txn = process_message(service, mid)
        except Exception as e:
            log.error(f"  Error on {mid}: {e}")
            continue

        if txn is None:
            processed_ids.add(mid)
            continue

        invoice_key = txn.get("invoice_key")
        if invoice_key in processed_invoice_keys or already_imported(txn):
            log.info(f"  Already exists: {txn['tool']} {txn['date']}")
            processed_ids.add(mid)
            if invoice_key:
                processed_invoice_keys.add(invoice_key)
            continue

        # Save PDF
        if txn["pdf_bytes"] and txn["pdf_name"]:
            (INVOICES_DIR / txn["pdf_name"]).write_bytes(txn["pdf_bytes"])
            log.info(f"  Saved PDF: {txn['pdf_name']}")

        if insert_transaction(txn):
            new_txns.append(txn)
            processed_ids.add(mid)
            if invoice_key:
                processed_invoice_keys.add(invoice_key)

    save_processed_state(processed_ids, processed_invoice_keys)

    if new_txns:
        log.info(f"Added {len(new_txns)} new transactions → rebuilding")
        rebuild_and_push(new_txns)
        _out = sys.stdout if hasattr(sys.stdout, "buffer") else sys.stdout
        try:
            print(f"[OK]  {len(new_txns)} חשבוניות חדשות נוספו אוטומטית:")
            for t in new_txns:
                print(f"   - {t['tool']}  {t['date']}  ${t['amount_usd']}")
        except UnicodeEncodeError:
            pass  # log already captured everything important
    else:
        log.info("No new transactions")
        try:
            print("[OK]  אין חשבוניות חדשות")
        except UnicodeEncodeError:
            pass

    write_status(new_txns)

    if not new_txns:
        push_status_only()
    log.info("Done")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log.exception("Fatal error in main()")
        write_status([], error=exc)
        raise
