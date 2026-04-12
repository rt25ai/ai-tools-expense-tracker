#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Send Telegram notifications for new expense entries."""

import logging
import os
import requests

log = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get(
    "TELEGRAM_BOT_TOKEN", "8556418662:AAFKeMVDBoOA2EGSd-wWGci4Vzi1R_MF8Z8"
)
CHAT_ID = "7008452440"
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


def _format_amount(entry: dict) -> str:
    currency = entry.get("currency", "USD")
    amount = entry.get("original_amount", entry.get("amount_usd", 0))
    if currency == "ILS":
        return f"₪{amount:,.2f}"
    return f"${amount:,.2f}"


def notify_new_charge(entry: dict, source: str = "auto") -> bool:
    """
    Send a Telegram message about a newly added charge.

    entry fields used: tool, description, date, currency, original_amount / amount_usd
    source: "auto"   — scanned from Gmail automatically
            "manual" — added manually via the dashboard
    """
    source_label = "סריקת Gmail" if source == "auto" else "הוספה ידנית"
    amount_str = _format_amount(entry)

    text = (
        f"💳 *חיוב חדש נרשם!*\n"
        f"\n"
        f"🏢 *ספק:* {entry.get('tool', '?')}\n"
        f"📝 *תיאור:* {entry.get('description', '?')}\n"
        f"📅 *תאריך:* {entry.get('date', '?')}\n"
        f"💰 *סכום:* {amount_str}\n"
        f"🔍 *מקור:* {source_label}\n"
        f"\n"
        f"✅ עודכן בממשק הניהול\n"
        f"✅ עודכן בגליון האקסל"
    )

    try:
        resp = requests.post(
            TELEGRAM_API,
            json={
                "chat_id": CHAT_ID,
                "text": text,
                "parse_mode": "Markdown",
            },
            timeout=10,
        )
        if resp.ok:
            log.info(f"Telegram notification sent for {entry.get('tool')} {entry.get('date')}")
            return True
        log.warning(f"Telegram notification failed: {resp.status_code} {resp.text}")
    except Exception as e:
        log.warning(f"Telegram notification error: {e}")
    return False


def notify_multiple_charges(entries: list, source: str = "auto") -> None:
    """Send one notification per new charge."""
    for entry in entries:
        notify_new_charge(entry, source=source)
