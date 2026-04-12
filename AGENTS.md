# הנחיות לסוכן AI — מעקב הוצאות כלים

> קרא את כל המסמך לפני שאתה נוגע בקוד.

---

## מה הפרויקט עושה

מעקב הוצאות על כלי AI. המערכת:
1. סורקת Gmail אוטומטית ומחלצת חשבוניות
2. מאחסנת אותן ב-`build_report.py` (ייבוא אוטומטי) ו-`manual_receipts.json` (ייבוא ידני)
3. בונה קובץ Excel ודשבורד Next.js
4. מפרסמת ל-GitHub Pages דרך `docs/`

---

## ארכיטקטורה — מקורות נתונים

יש **שני מקורות נתונים** שמתמזגים ב-`build_report.py`:

| מקור | קובץ | מי כותב |
|------|------|---------|
| ייבוא אוטומטי (Gmail) | `MANUAL_TRANSACTIONS` ב-`build_report.py` | `auto_invoice.py` |
| ייבוא ידני (דשבורד) | `manual_receipts.json` | ממשק הדשבורד דרך GitHub API |

`build_report.py` מאחד את שניהם בשורה 328–329:
```python
manual = list(MANUAL_TRANSACTIONS)
manual.extend(to_transaction_tuple(entry) for entry in load_manual_receipts())
```

**חשוב:** אל תכפיל רשומה בשני המקורות — זה ייצור כפילויות בדוחות.

---

## קבצים מרכזיים

### Python (שרת/לוקאל)
| קובץ | תפקיד |
|------|--------|
| `build_report.py` | בונה Excel + כותב `docs/data.json`. רץ מקומית ו-CI. |
| `auto_invoice.py` | סורק Gmail, מחלץ סכומים, מוסיף ל-`MANUAL_TRANSACTIONS`, עושה commit+push. |
| `exchange_rate.py` | שליפת שער USD/ILS מבנק ישראל. |
| `manual_receipts_store.py` | קריאה/כתיבה של `manual_receipts.json`. |
| `auto_invoice_status.json` | נכתב אחרי כל ריצה של `auto_invoice.py` — מכיל last_run, next_run, result. |

### Dashboard (Next.js)
| קובץ | תפקיד |
|------|--------|
| `dashboard-web/src/lib/dashboard-data.ts` | קורא `docs/data.json` ומחשב את כל המודל לדשבורד. |
| `dashboard-web/src/lib/github-direct-client.ts` | קריאות GitHub REST API ישירות מהדפדפן (CRUD על `manual_receipts.json`). |
| `dashboard-web/public/manual-import-config.json` | קונפיגורציה: `mode: "github-direct"`, owner/repo/branch. |
| `dashboard-web/src/components/manual-receipt-import-client.tsx` | טופס הוספה/עריכה/מחיקה של קבלות. |
| `dashboard-web/src/components/settings-page-client.tsx` | הגדרות + כרטיס GitHub Token. |
| `dashboard-web/src/app/automations/page.tsx` | עמוד אוטומציות — מציג נתוני `scanner_status` אמיתיים. |

### CI/CD
| קובץ | תפקיד |
|------|--------|
| `.github/workflows/rebuild-manual-imports.yml` | מופעל כשמשתנה `manual_receipts.json` → בונה Excel + דשבורד → commit+push. |

---

## זרימת הנתונים המלאה

### כשמוסיפים קבלה ידנית מהדשבורד:
```
דשבורד → github-direct-client.ts → GitHub API
→ manual_receipts.json מתעדכן ב-GitHub
→ GitHub Actions מופעל אוטומטית
→ python build_report.py (CI)
→ npm run build (Next.js)
→ docs/ מתעדכן → GitHub Pages מתעדכן
```

### כש-auto_invoice.py רץ (כל יום ב-08:00):
```
Windows Task Scheduler → auto_invoice.py
→ Gmail API (90 יום אחורה)
→ MANUAL_TRANSACTIONS ב-build_report.py מתעדכן
→ python build_report.py (לוקאלי)
→ auto_invoice_status.json נכתב
→ git commit + push → GitHub Actions
→ דשבורד מתעדכן
```

---

## GitHub Direct Mode

ממשק הדשבורד עובד **ישירות מול GitHub API** — אין שרת ביניים.
- הטוקן (GitHub Fine-grained PAT) נשמר ב-`localStorage` של הדפדפן.
- הטוקן צריך הרשאות: `Contents: Read and Write` על ה-repo `rt25ai/ai-tools-expense-tracker`.
- הקונפיגורציה נמצאת ב: `dashboard-web/public/manual-import-config.json`

---

## CapCut — מקרה מיוחד

CapCut **לא נכלל בייבוא אוטומטי מ-Gmail** מסיבות טכניות:
- המייל שלהם HTML בלבד (ללא plain text)
- דף החשבונית הוא SPA שמחזיר שגיאת PAY000 לגישה headless

**הפתרון שיושם:** כשהסקריפט מזהה מייל של CapCut — הוא משתמש בסכום קבוע:
```python
CAPCUT_FALLBACK_ILS = 49.90  # עדכן אם המחיר משתנה
```
הסכום קבוע כי CapCut חייב 49.90 ₪ כל חודש (עקבי מינואר 2026).

---

## כללי פיתוח

### מה לעשות תמיד

1. **לאחר כל שינוי ב-Python** — בדוק שה-CI לא נשבר:
   ```bash
   python build_report.py
   ```

2. **לאחר כל שינוי ב-TypeScript** — בנה לפני push:
   ```bash
   cd dashboard-web && npm run build
   ```

3. **הגדרת path ב-build_report.py** — תמיד השתמש בזיהוי CI:
   ```python
   some_path = (
       Path("relative/path")
       if os.environ.get("CI")
       else Path(r"C:\Users\roita\מעקב הוצאות כלים\relative\path")
   )
   ```

4. **לאחר כל שינוי** — commit + push ל-master. GitHub Actions יטפל בשאר.

### מה לא לעשות

- **אל תכתוב נתיבי Windows מוחלטים** ב-`build_report.py` ללא גיבוי CI — זה שובר את GitHub Actions.
- **אל תוסיף CapCut ידנית ל-`manual_receipts.json` AND ל-MANUAL_TRANSACTIONS** — יצור כפילות.
- **אל תשנה `docs/data.json` ישירות** — הוא נוצר אוטומטית על ידי `build_report.py`.
- **אל תוסיף `dashboard-web/public/data.json` ל-git** — הוא ב-`.gitignore` ונוצר ב-prebuild.
- **אל תשבור את הגיבוי של שני ה-branches** — כל push ל-master צריך להתעדכן גם ב-main.

---

## הרצה מקומית

```bash
# בניית Excel + data.json
python build_report.py

# בניית דשבורד
cd dashboard-web
npm ci
npm run build   # כולל prebuild שמריץ sync-data.mjs

# הרצת ייבוא Gmail
python auto_invoice.py

# שרת פיתוח
cd dashboard-web && npm run dev
```

---

## משתני סביבה ב-CI (GitHub Actions)

אין צורך להגדיר secrets נוספים. הבנייה ב-CI:
- **Python:** `pip install openpyxl requests pdfplumber`
- **Node:** גרסה 22, `npm ci`
- **אין Gmail credentials ב-CI** — `auto_invoice.py` רץ רק לוקאלית

---

## מבנה `data.json`

הקובץ `docs/data.json` מכיל את כל הנתונים שהדשבורד קורא:

```json
{
  "generated": "2026-04-11",
  "usd_rate": 3.65,
  "grand_total": 2075.68,
  "grand_total_ils": 6459.15,
  "current_month": "2026-04",
  "current_month_total": 123.45,
  "scanner_status": {
    "last_run": "2026-04-11T21:33:41",
    "next_run": "2026-04-12T08:00:00",
    "result": "ok",
    "new_count": 0,
    "new_tools": [],
    "error": null
  },
  "transactions": [...],
  "monthly": { "2026-01": 180.5, ... },
  "by_tool": { "OpenAI": 95.0, ... }
}
```

---

## כתובת ה-repo ו-GitHub Pages

- **Repo:** `https://github.com/rt25ai/ai-tools-expense-tracker`
- **Branch ראשי:** `master` (משוכפל ל-`main` אחרי כל push)
- **GitHub Pages:** מגיש מ-`docs/` ב-branch `master`
- **Task Scheduler:** משימה בשם `"AI Tools Invoice Scanner"` — רצה כל יום ב-08:00

---

## Graphify

- `Graphify` מוגדר בפרויקט הזה כגרף ידע ממוקד-קוד, לא על ארטיפקטים בנויים.
- קובץ `.graphifyignore` מוציא מהריצה את `docs/`, `graphify-out/`, `tmp/`, קבצי PDF וארטיפקטים כבדים כדי שהגרף יתמקד בארכיטקטורה ובקוד המקור.
- כדי לרענן את הגרף, הרץ מה-root:
  ```bash
  python rebuild_graphify.py
  ```
- הפלט נכתב ל-`graphify-out/`:
  - `GRAPH_REPORT.md` — סיכום קהילות, god nodes ושאלות מעניינות
  - `graph.json` — הגרף עצמו
  - `graph.html` — ויזואליזציה לפתיחה בדפדפן
- לפני מענה על שאלות ארכיטקטורה/קודבייס, עדיף לקרוא קודם את `graphify-out/GRAPH_REPORT.md`.
- לשאילתות ממוקדות על הגרף אפשר להריץ:
  ```bash
  python -m graphify query "your question" --graph graphify-out/graph.json
  ```
- אחרי שינויי קוד, רענן שוב עם `python rebuild_graphify.py`.
