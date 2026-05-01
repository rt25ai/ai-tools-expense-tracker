#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Utilities for fetching the official USD/ILS exchange rate."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.request import urlopen

BOI_USD_RATE_URL = "https://boi.org.il/PublicApi/GetExchangeRate?key=USD"
BOI_SOURCE_LABEL = "Bank of Israel Public API"
FALLBACK_USD_ILS_RATE = 3.65
_HIST_CACHE_PATH = Path(__file__).with_name("historical_rates.json")


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


def fetch_historical_rate(date: str, timeout: int = 8) -> float:
    """Return the locked USD/ILS rate for a specific past date.

    Checks historical_rates.json cache first; fetches from fawazahmed0 API on miss
    and persists the result so the rate never changes after first lookup.
    """
    cache: dict[str, float] = {}
    if _HIST_CACHE_PATH.exists():
        try:
            cache = json.loads(_HIST_CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    if date in cache:
        return cache[date]

    url = f"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/usd.json"
    try:
        with urlopen(url, timeout=timeout) as response:
            payload = json.load(response)
        raw = payload.get("usd", {}).get("ils")
        if isinstance(raw, (int, float)):
            rate = round(float(raw), 4)
            cache[date] = rate
            _HIST_CACHE_PATH.write_text(
                json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            return rate
    except Exception:
        pass

    return FALLBACK_USD_ILS_RATE


def fetch_usd_to_ils_rate(timeout: int = 10) -> tuple[float, str | None, str]:
    """Return (rate, last_update, source_label) with a safe fallback."""
    try:
        with urlopen(BOI_USD_RATE_URL, timeout=timeout) as response:
            payload = json.load(response)
        rate, updated_at = _extract_rate(payload)
        return round(rate, 3), updated_at, BOI_SOURCE_LABEL
    except Exception:
        return FALLBACK_USD_ILS_RATE, None, f"{BOI_SOURCE_LABEL} (fallback)"
