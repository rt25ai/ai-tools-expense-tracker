# cc-py — Personal Command Center scanner

Python side of the personal-cc extension. Lives on `demo/personal-cc` branch only.

## What this does

Extends the existing Gmail scanner pattern (`auto_invoice.py`) WITHOUT modifying it.
Reads emails from `accounting@finbot.co.il` (Dinaroz CCs) and writes
quotes/invoices/receipts to a NEW Supabase project.

## Layout

```
cc-py/
  ├── README.md                  # this file
  ├── .env.example               # copy to .env, fill secrets
  ├── requirements.txt
  ├── dinaroz_email_parser.py    # subject regex + PDF parser (Phase B)
  ├── supabase_writer.py         # idempotent UPSERTs (Phase B)
  ├── cc_scan.py                 # standalone runner (Phase B)
  ├── supabase/
  │   └── migrations/
  │       ├── 0001_phase_a.sql   # tasks, content_log, meetings, manual_income, manual_expense_other
  │       └── 0002_phase_b.sql   # quotes, invoices, receipts, email_imports
  └── tests/
      ├── test_dinaroz_email_parser.py
      └── fixtures/
          ├── quote_524.eml
          ├── invoice_210.eml
          └── receipt_127.eml
```

## Setup (when you start Phase B)

```bash
cd cc-py
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase URL + service role key
```

## Apply Supabase migrations

In a NEW Supabase project (`roi-personal-cc`):

1. Open SQL editor
2. Paste contents of `supabase/migrations/0001_phase_a.sql`, run
3. (Phase B only) Paste contents of `0002_phase_b.sql`, run
4. Create storage bucket `expense-attachments` (commands at bottom of `0001_phase_a.sql`)

## Run scanner (Phase B, after parser is built)

```bash
cd cc-py
python cc_scan.py            # one-shot scan, last 90 days
python cc_scan.py --watch    # not implemented yet — runs once, exits
```

Schedule via Windows Task Scheduler at 08:30 (30 minutes after the existing
`auto_invoice.py` run at 08:00) so the two scanners don't collide.

## What this does NOT do

- Does not modify `auto_invoice.py` (it stays untouched on master)
- Does not call Vercel — scanner runs ONLY on your local machine
- Does not scrape Dinaroz site — emails only
- Does not write to the existing tracker's data files
