-- Phase B schema: Dinaroz email ingestion (quotes, invoices, receipts, idempotency)
-- Apply AFTER Phase A is in production use

-- =========================================================
-- quotes (הצעות מחיר from Dinaroz emails)
-- customer_name + amount nullable: subject parsing alone can't fill them
-- status='needs_detail' = Tier 1 row awaiting fill (manual or PDF parse)
-- =========================================================
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dinaroz_doc_number text not null,
  customer_name text,
  amount numeric check (amount is null or amount >= 0),
  currency text not null default 'ILS' check (currency in ('ILS','USD')),
  sent_at date not null,
  status text not null default 'needs_detail'
    check (status in ('needs_detail','pending','accepted','rejected','expired')),
  source text not null default 'email' check (source in ('email','manual')),
  gmail_message_id text unique,
  raw_subject text,
  notes text,
  created_at timestamptz not null default now()
);
create index quotes_owner_status_idx on public.quotes (owner_id, status);
create index quotes_owner_sent_idx on public.quotes (owner_id, sent_at desc);
create index quotes_owner_doc_idx on public.quotes (owner_id, dinaroz_doc_number);
alter table public.quotes enable row level security;
create policy quotes_owner_all on public.quotes for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- invoices (חשבון עסקה from Dinaroz emails)
-- =========================================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dinaroz_doc_number text not null,
  customer_name text,
  amount numeric check (amount is null or amount >= 0),
  currency text not null default 'ILS' check (currency in ('ILS','USD')),
  issued_at date not null,
  due_at date,
  status text not null default 'needs_detail'
    check (status in ('needs_detail','open','paid','cancelled')),
  quote_id uuid references public.quotes(id) on delete set null,
  source text not null default 'email' check (source in ('email','manual')),
  gmail_message_id text unique,
  raw_subject text,
  created_at timestamptz not null default now()
);
create index invoices_owner_status_idx on public.invoices (owner_id, status);
create index invoices_owner_issued_idx on public.invoices (owner_id, issued_at desc);
create index invoices_owner_doc_idx on public.invoices (owner_id, dinaroz_doc_number);
alter table public.invoices enable row level security;
create policy invoices_owner_all on public.invoices for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- receipts (קבלה from Dinaroz emails)
-- =========================================================
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dinaroz_doc_number text not null,
  customer_name text,
  amount numeric check (amount is null or amount >= 0),
  currency text not null default 'ILS' check (currency in ('ILS','USD')),
  paid_at date not null,
  invoice_id uuid references public.invoices(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  source text not null default 'email' check (source in ('email','manual')),
  gmail_message_id text unique,
  raw_subject text,
  created_at timestamptz not null default now()
);
create index receipts_owner_paid_idx on public.receipts (owner_id, paid_at desc);
create index receipts_owner_customer_idx on public.receipts (owner_id, customer_name);
alter table public.receipts enable row level security;
create policy receipts_owner_all on public.receipts for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- email_imports: idempotency for the Gmail scanner
-- gmail_message_id is primary key — re-running scanner skips already-processed emails
-- =========================================================
create table public.email_imports (
  gmail_message_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null
    check (email_type in ('tool_charge','quote','invoice','receipt','unknown')),
  processed_at timestamptz not null default now(),
  result text not null check (result in ('imported','skipped','error','needs_detail')),
  error_message text
);
create index email_imports_owner_processed_idx on public.email_imports (owner_id, processed_at desc);
alter table public.email_imports enable row level security;
create policy email_imports_owner_all on public.email_imports for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- Add foreign key from tasks.related_quote_id to quotes (deferred until quotes exists)
-- =========================================================
alter table public.tasks
  add constraint tasks_related_quote_fk
  foreign key (related_quote_id) references public.quotes(id) on delete set null;
