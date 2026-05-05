#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Convert all USD transactions to historical ILS amounts and rewrite build_report.py."""

import re

RATES = {
    '2025-07-04': 3.3365, '2025-07-09': 3.3483, '2025-07-10': 3.3092,
    '2025-07-11': 3.3151, '2025-07-20': 3.3579, '2025-07-30': 3.3663,
    '2025-08-01': 3.3944, '2025-08-02': 3.4127, '2025-08-04': 3.4102,
    '2025-08-05': 3.4176, '2025-08-09': 3.4338, '2025-08-10': 3.4332,
    '2025-08-11': 3.4215, '2025-08-30': 3.3421,
    '2025-09-01': 3.3362, '2025-09-05': 3.3481, '2025-09-10': 3.3434,
    '2025-09-24': 3.3429, '2025-09-30': 3.3013,
    '2025-10-02': 3.3163, '2025-10-24': 3.2902, '2025-10-30': 3.2531,
    '2025-11-09': 3.2599, '2025-11-11': 3.229,  '2025-11-13': 3.1955,
    '2025-11-24': 3.276,  '2025-11-30': 3.2617,
    '2025-12-01': 3.2583, '2025-12-03': 3.252,  '2025-12-08': 3.232,
    '2025-12-16': 3.2129, '2025-12-29': 3.1893, '2025-12-30': 3.1857,
    '2026-01-01': 3.1857, '2026-01-03': 3.1856, '2026-01-05': 3.1753,
    '2026-01-08': 3.1667, '2026-01-10': 3.1491, '2026-01-19': 3.1488,
    '2026-01-25': 3.1283, '2026-01-27': 3.1163, '2026-01-30': 3.0853,
    '2026-02-01': 3.1023, '2026-02-02': 3.1006, '2026-02-03': 3.099,
    '2026-02-10': 3.0831, '2026-02-12': 3.0771, '2026-02-15': 3.0863,
    '2026-02-16': 3.0886, '2026-02-24': 3.128,  '2026-02-25': 3.0992,
    '2026-02-28': 3.1354,
    '2026-03-01': 3.1283, '2026-03-02': 3.1204, '2026-03-03': 3.0772,
    '2026-03-10': 3.0952, '2026-03-12': 3.1308, '2026-03-15': 3.1436,
    '2026-03-19': 3.1112, '2026-03-25': 3.1249,
    '2026-04-01': 3.1433, '2026-04-03': 3.1329, '2026-04-05': 3.1414,
}

# Raw MANUAL_TRANSACTIONS as-is from build_report.py
TXN = [
    ("2025-07-04", "Recraft",       "Basic \u2013 first month promo",             1.00),
    ("2025-07-09", "Ideogram AI",   "Ideogram Basic \u2013 annual",              72.00),
    ("2025-07-10", "Make",          "Core plan 10k ops/month",                   10.59),
    ("2025-07-11", "Anthropic",     "Claude Pro",                                20.00),
    ("2025-07-20", "Runway ML",     "Standard (10% affiliate off)",              13.50),
    ("2025-07-30", "Replicate",     "Early card charge",                         10.00),
    ("2025-07-30", "Ideogram AI",   "Upgrade -> Plus Annual",                   113.14),
    ("2025-08-01", "Google Workspace", "Business Plus \u2013 Jul 2025 (\u20aa56.93)", 15.60),
    ("2025-08-02", "Runway ML",     "Credits 1,500",                             15.00),
    ("2025-08-04", "Recraft",       "Basic monthly",                             12.00),
    ("2025-08-05", "Replicate",     "Usage - July",                               0.90),
    ("2025-08-09", "Manus AI",      "Basic monthly",                             19.00),
    ("2025-08-10", "Make",          "Core plan 10k ops/month",                   10.59),
    ("2025-08-11", "Anthropic",     "Claude Pro",                                20.00),
    ("2025-08-30", "Runway ML",     "Standard (25% off)",                        11.25),
    ("2025-08-30", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2025-09-01", "Google Workspace", "Business Plus \u2013 Aug 2025 (\u20aa56.93)", 15.60),
    ("2025-09-05", "Replicate",     "Usage - August",                             2.79),
    ("2025-09-10", "Make",          "Core plan 10k ops/month",                   10.59),
    ("2025-09-24", "Anthropic",     "Claude Pro",                                20.00),
    ("2025-09-30", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2025-10-02", "Google Workspace", "Business Plus \u2013 Sep 2025 (\u20aa56.93)", 15.60),
    ("2025-10-24", "Anthropic",     "Claude Pro",                                20.00),
    ("2025-10-30", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2025-11-09", "Recraft",       "Pro 1k credits",                            12.00),
    ("2025-11-11", "Astria",        "Credits x10 + 18% VAT",                     11.80),
    ("2025-11-11", "Runway ML",     "Standard monthly",                          15.00),
    ("2025-11-13", "Hedra",         "Extra Small Credit Pack",                   10.00),
    ("2025-11-24", "Anthropic",     "Claude Pro",                                20.00),
    ("2025-11-30", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2025-12-01", "Google Workspace", "Business Plus \u2013 Nov 2025 (\u20aa75.90)", 20.79),
    ("2025-12-03", "Manychat",      "Pro monthly",                               15.00),
    ("2025-12-03", "Meta (Ads)",    "Facebook Ads",                               9.72),
    ("2025-12-08", "Meta (Ads)",    "Facebook Ads",                              30.00),
    ("2025-12-16", "Meta (Ads)",    "Facebook Ads",                              33.00),
    ("2025-12-29", "Meta (Ads)",    "Facebook Ads",                              36.00),
    ("2025-12-30", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2026-01-01", "Google Workspace", "Business Plus \u2013 Dec 2025 (\u20aa75.90)", 20.79),
    ("2026-01-03", "Genspark",      "Plus Annual (happynewyear26 promo)",       139.92),
    ("2026-01-03", "Manychat",      "Pro monthly",                               15.00),
    ("2026-01-03", "Meta (Ads)",    "Facebook Ads",                              19.43),
    ("2026-01-05", "Genspark",      "Credits Pack",                              20.00),
    ("2026-01-08", "Genspark",      "Credits Pack",                              20.00),
    ("2026-01-10", "CapCut",        "Pro \u2013 Jan 2026 (\u20aa49.90)",         13.67),
    ("2026-01-19", "Meta (Ads)",    "Facebook Ads",                              39.00),
    ("2026-01-25", "Lovable",       "Pro 1 monthly",                             25.00),
    ("2026-01-27", "Meta (Ads)",    "Facebook Ads",                              43.00),
    ("2026-01-30", "Timeless",      "Pro monthly (50% off)",                     14.50),
    ("2026-01-30", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2026-02-01", "Lovable",       "Upgrade Pro1 -> Pro2 (prorated)",           25.00),
    ("2026-02-02", "Google Workspace", "Business Plus \u2013 Jan 2026 (\u20aa75.90)", 20.79),
    ("2026-02-02", "Google Workspace", "Google Workspace (\u20aa75.9)",          75.90, "ILS"),
    ("2026-02-03", "Meta (Ads)",    "Facebook Ads",                              31.42),
    ("2026-02-10", "CapCut",        "Pro \u2013 Feb 2026 (\u20aa49.90)",         13.67),
    ("2026-02-12", "Meta (Ads)",    "Facebook Ads",                              47.00),
    ("2026-02-15", "Anthropic",     "Claude Pro",                                20.00),
    ("2026-02-16", "Anthropic",     "Credit purchase",                            5.00),
    ("2026-02-24", "Higgsfield",    "On-Demand credits 500",                     20.00),
    ("2026-02-25", "Meta (Ads)",    "Facebook Ads",                              51.00),
    ("2026-02-25", "Lovable",       "Pro2 monthly",                              50.00),
    ("2026-02-28", "Eleven Labs",   "Starter monthly",                            5.00),
    ("2026-02-28", "Lovable",       "Cloud & AI Balance Top-up",                 10.00),
    ("2026-03-01", "Lovable",       "Cloud & AI Balance Top-up",                 10.00),
    ("2026-03-01", "Timeless",      "Pro monthly (50% off)",                     14.50),
    ("2026-03-01", "Google Workspace", "Google Workspace (\u20aa75.9)",          75.90, "ILS"),
    ("2026-03-02", "Lovable",       "Cloud & AI Balance Top-up",                 10.00),
    ("2026-03-02", "Google Workspace", "Business Plus \u2013 Feb 2026 (\u20aa75.90)", 20.79),
    ("2026-03-03", "Meta (Ads)",    "Facebook Ads",                              40.11),
    ("2026-03-10", "CapCut",        "Pro \u2013 Mar 2026 (\u20aa49.90)",         13.67),
    ("2026-03-12", "Meta (Ads)",    "Facebook Ads",                              51.00),
    ("2026-03-15", "Anthropic",     "Claude Pro",                                20.00),
    ("2026-03-19", "Anthropic",     "Credit purchase",                           10.00),
    ("2026-03-19", "Eleven Labs",   "Creator (first month 50% off)",             11.00),
    ("2026-03-25", "Lovable",       "Lite plan",                                  5.00),
    ("2026-04-01", "Meta (Ads)",    "Facebook Ads",                             166.33, "ILS"),
    ("2026-04-01", "Anthropic",     "Claude Pro",                                20.00),
    ("2026-04-01", "Anthropic",     "Credit purchase",                            5.00),
    ("2026-04-01", "Google Workspace", "Business Plus \u2013 Mar 2026 (\u20aa75.90)", 20.79),
    ("2026-04-01", "Google Workspace", "Google Workspace (\u20aa75.9)",          75.90, "ILS"),
    ("2026-04-03", "Meta (Ads)",    "Facebook Ads",                               2.25),
    ("2026-04-05", "IONOS",         "Instant Domain",                            20.00),
]

# Entries with ₪ in description = charged in ILS directly; extract ILS amount from description
ILS_IN_DESC = {
    "Business Plus \u2013 Jul 2025 (\u20aa56.93)": 56.93,
    "Business Plus \u2013 Aug 2025 (\u20aa56.93)": 56.93,
    "Business Plus \u2013 Sep 2025 (\u20aa56.93)": 56.93,
    "Business Plus \u2013 Nov 2025 (\u20aa75.90)": 75.90,
    "Business Plus \u2013 Dec 2025 (\u20aa75.90)": 75.90,
    "Business Plus \u2013 Jan 2026 (\u20aa75.90)": 75.90,
    "Business Plus \u2013 Feb 2026 (\u20aa75.90)": 75.90,
    "Business Plus \u2013 Mar 2026 (\u20aa75.90)": 75.90,
    "Pro \u2013 Jan 2026 (\u20aa49.90)": 49.90,
    "Pro \u2013 Feb 2026 (\u20aa49.90)": 49.90,
    "Pro \u2013 Mar 2026 (\u20aa49.90)": 49.90,
}

def convert(t):
    date, tool, desc = t[0], t[1], t[2]
    if len(t) == 5 and t[4] == "ILS":
        return t  # already ILS - keep
    usd = t[3]
    # ILS-billed items with ₪ in description
    if desc in ILS_IN_DESC:
        ils = ILS_IN_DESC[desc]
        return (date, tool, desc, ils, "ILS")
    # USD → ILS via historical rate
    rate = RATES.get(date)
    if rate:
        ils = round(usd * rate, 2)
        return (date, tool, desc, ils, "ILS")
    return t  # fallback: keep as-is

converted = [convert(t) for t in TXN]

# Print summary of changes
print("CONVERTED TRANSACTIONS:")
for orig, conv in zip(TXN, converted):
    if len(orig) == 4:
        orig_str = f"USD {orig[3]:.2f}"
        conv_str = f"ILS {conv[3]:.2f}" if len(conv)==5 else f"??? {conv[3]}"
        print(f"  {orig[0]} {orig[1][:20]:20} {orig_str:12} -> {conv_str}")
    else:
        print(f"  {orig[0]} {orig[1][:20]:20} ILS {orig[3]:.2f}  (unchanged)")
