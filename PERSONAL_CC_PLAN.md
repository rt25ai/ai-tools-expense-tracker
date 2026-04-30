# Personal Command Center — Project Handoff

> **Generated 2026-04-30** as part of the expense tracker → personal command center extension. If you (Claude) are reading this in `C:\Users\roita\מעקב הוצאות כלים\`, this file is your starting context.

## What this project is becoming

The original "AI tools expense tracker" stays alive and running. On top of it, an additional system is being built — a **personal command center** for Roi. It extends the same Gmail-scanner pattern, adds dynamic state (tasks, content log, meeting notes, quotes/invoices/receipts), and gives Roi a single dashboard for daily ops.

Origin: Roi's previous CRM at `c:\Users\roita\rt-ai-crm` grew too complex. He chose to **archive that CRM** and instead extend this expense tracker — because this codebase is already lean, deployed, and working.

## Demo-first rule (CRITICAL)

**The existing tracker MUST keep working unchanged during all development.** The new work lives on a separate branch `demo/personal-cc` and inside two NEW directories:

- `cc-py/` — Python scanner extensions (Dinaroz email parsing, Supabase writer)
- `dashboard-cc/` — separate Next.js app (fresh `create-next-app` install)

These directories do not touch:
- `auto_invoice.py`, `build_report.py`, `generate_dashboard_data.py`, `manual_receipts_store.py`, etc.
- `dashboard-web/`
- `vendor_rules.json`, `manual_receipts.json`, `docs/data.json`, `AI_Tools_Expenses_2025_2026.xlsx`
- Existing GitHub Actions workflows

If you need to modify any of those, **stop and ask**. Cutover into the existing tracker happens only after Roi has used the demo for ≥1 week and explicitly says to merge.

## Architecture summary

| Layer | Where | Notes |
|---|---|---|
| Existing tools-expense pipeline | as-is | untouched |
| New scanner | `cc-py/cc_scan.py` | reuses Gmail OAuth (`gmail_token.json`), does NOT modify `auto_invoice.py` |
| Dynamic state | new Supabase project `roi-personal-cc` | tasks, content_log, meetings, quotes, invoices, receipts, manual_income, manual_expense_other, email_imports |
| New dashboard | `dashboard-cc/` (Next.js 16, React 19, Tailwind 4, shadcn) | client-side Supabase, magic-link auth |
| Hosting (demo) | Vercel preview from `demo/personal-cc` branch (or GH Pages `/personal-cc/`) | independent of `/ai-tools-expense-tracker/` |
| Dinaroz | href button only | NO scraping, NO Playwright, NO API integration |

## Dinaroz email patterns (already captured)

- **Sender:** `accounting@finbot.co.il`
- **Subject regex:** `^(הצעת מחיר|חשבון עסקה|קבלה)\s+(\d+)\s+נשלחה אליך מאת\s+(.+)$`
- **Type map:** `הצעת מחיר → quote`, `חשבון עסקה → invoice`, `קבלה → receipt`
- **Body:** `מספר המסמך: <N>` + "לצפייה לחץ כאן" link. Customer + amount NOT in body — must come from PDF attachment OR be filled by Roi via UI.
- **Two-tier strategy:** Tier 1 captures type + number + date from subject (always); Tier 2 attempts customer + amount from PDF via `pdfplumber` (best-effort).

## Pages in `dashboard-cc/`

Phase A: `/login`, `/today`, `/tasks`, `/income`, `/expenses-other`, `/content`, `/meetings`, `/monthly`
Phase B (adds): `/quotes`, `/invoices`, `/receipts`

## Phases

1. **Phase A** (~1–2 days): manual entry only, lean dashboard core. Roi starts using it.
2. **Phase B** (~2–3 days): Dinaroz email ingestion. Auto-populates quotes/invoices/receipts/income.
3. **Phase C** (deferred): calendar integration, push notifications, OCR for arbitrary expense PDFs, auto-expire pending quotes.

## What is explicitly NOT being built

- Dinaroz site integration (Playwright/CDP/scraping) — emails only
- Sales pipeline (clients/leads/deals/quotes-as-CRM-stage) — quotes here are simply documents
- Public API endpoints — single user, RLS-locked Supabase, magic-link auth
- OCR / arbitrary file ingestion in Phase A
- Modification of existing tracker code during demo

## Security

- Anon Supabase key in browser (RLS protects)
- Service role key in `cc-py/.env` (NEVER committed; `.gitignore` covers)
- 2FA on the Supabase account
- All tables RLS-locked to `auth.uid()`
- Storage bucket `expense-attachments`: private, owner-prefix path scoping

## Where to find the full plan

The original detailed plan lives at `C:\Users\roita\.claude\plans\smooth-wishing-bird.md`. This file is the condensed handoff — go to the full plan for SQL schemas, exact file lists, verification checklists, cutover steps.

## When in doubt

Ask Roi before:
- Touching anything outside `cc-py/`, `dashboard-cc/`, or this `PERSONAL_CC_PLAN.md`
- Merging `demo/personal-cc` into `main`
- Adding a new Dinaroz integration path (he wants emails-only)
- Adding any public-read API or unauthenticated endpoint
