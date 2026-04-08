#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Utilities for fetching the official USD/ILS exchange rate."""

from __future__ import annotations

import json
from typing import Any
from urllib.request import urlopen

BOI_USD_RATE_URL = "https://boi.org.il/PublicApi/GetExchangeRate?key=USD"
BOI_SOURCE_LABEL = "Bank of Israel Public API"
FALLBACK_USD_ILS_RATE = 3.65


def _extract_rate(payload: Any) -> tuple[float, str | None]:
    if isinstance(payload, dict):
        rate = payload.get("currentExchangeRate")
        updated_at = payload.get("lastUpdate")
        if isinstance(rate, (int, float)):
            return float(rate), updated_at if isinstance(updated_at, str) else None

        items = payload.get("exchangeRates") or payload.get("items")
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                if item.get("key") == "USD" and isinstance(item.get("currentExchangeRate"), (int, float)):
                    return float(item["currentExchangeRate"]), item.get("lastUpdate")

    raise ValueError("Official USD exchange rate was not found in the response payload.")


def fetch_usd_to_ils_rate(timeout: int = 10) -> tuple[float, str | None, str]:
    """Return (rate, last_update, source_label) with a safe fallback."""
    try:
        with urlopen(BOI_USD_RATE_URL, timeout=timeout) as response:
            payload = json.load(response)
        rate, updated_at = _extract_rate(payload)
        return round(rate, 3), updated_at, BOI_SOURCE_LABEL
    except Exception:
        return FALLBACK_USD_ILS_RATE, None, f"{BOI_SOURCE_LABEL} (fallback)"
