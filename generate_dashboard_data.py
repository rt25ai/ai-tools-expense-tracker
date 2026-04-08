#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json, sys
sys.path.insert(0, r"C:\Users\roita\מעקב הוצאות כלים")
from build_report import TRANSACTIONS
from pathlib import Path
from collections import defaultdict
import datetime

today = datetime.date.today()
dashboard_transactions = [
    t for t in TRANSACTIONS
    if datetime.date.fromisoformat(t[0]) <= today
]

txns = [{"date": t[0], "tool": t[1], "description": t[2], "amount": t[3]} for t in dashboard_transactions]
monthly = defaultdict(float)
by_tool = defaultdict(float)
for t in dashboard_transactions:
    ym = t[0][:7]
    monthly[ym] = round(monthly[ym] + t[3], 2)
    by_tool[t[1]] = round(by_tool[t[1]] + t[3], 2)

data = {
    "generated": today.isoformat(),
    "grand_total": round(sum(t[3] for t in dashboard_transactions), 2),
    "transactions": sorted(txns, key=lambda x: x["date"], reverse=True),
    "monthly": dict(sorted(monthly.items())),
    "by_tool": dict(sorted(by_tool.items(), key=lambda x: -x[1]))
}

Path(r"C:\Users\roita\מעקב הוצאות כלים\docs").mkdir(exist_ok=True)
Path(r"C:\Users\roita\מעקב הוצאות כלים\docs\data.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("Generated docs/data.json")
print(f"Grand total: ${data['grand_total']}")
print(f"Transactions: {len(txns)}")
