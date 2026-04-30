-- Phase A schema: lean dashboard core (manual entry only)
-- Personal Command Center on demo/personal-cc branch

-- =========================================================
-- tasks: counter mode + simple + content daily
-- =========================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null default 'simple' check (type in ('simple','counter','content_daily')),
  target_count int,
  done_count int not null default 0,
  channel text check (channel in ('whatsapp','instagram','blog','meeting','video','other')),
  status text not null default 'open' check (status in ('open','done','cancelled')),
  due_date date,
  related_quote_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index tasks_owner_status_idx on public.tasks (owner_id, status);
create index tasks_owner_due_idx on public.tasks (owner_id, due_date) where status = 'open';
alter table public.tasks enable row level security;
create policy tasks_owner_all on public.tasks for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- content_log: every IG/WA/blog post
-- =========================================================
create table public.content_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','instagram','blog')),
  posted_at timestamptz not null default now(),
  content_type text,
  title_or_excerpt text,
  url text,
  notes text
);
create index content_log_owner_channel_idx on public.content_log (owner_id, channel, posted_at desc);
alter table public.content_log enable row level security;
create policy content_log_owner_all on public.content_log for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- meetings
-- =========================================================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  meeting_date date not null,
  attendees text,
  summary text,
  action_items text,
  calendar_event_id text,
  created_at timestamptz not null default now()
);
create index meetings_owner_date_idx on public.meetings (owner_id, meeting_date desc);
alter table public.meetings enable row level security;
create policy meetings_owner_all on public.meetings for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- manual_income: rows Roi enters by hand
-- =========================================================
create table public.manual_income (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'ILS' check (currency in ('ILS','USD')),
  paid_at date not null,
  description text,
  created_at timestamptz not null default now()
);
create index manual_income_owner_paid_idx on public.manual_income (owner_id, paid_at desc);
create index manual_income_owner_customer_idx on public.manual_income (owner_id, customer_name);
alter table public.manual_income enable row level security;
create policy manual_income_owner_all on public.manual_income for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- manual_expense_other: non-tool expenses (taxes, etc.)
-- =========================================================
create table public.manual_expense_other (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  currency text not null default 'ILS' check (currency in ('ILS','USD')),
  expense_date date not null,
  category text not null default 'אחר' check (category in ('מסים','אחר')),
  vendor text,
  description text,
  attachment_path text,
  created_at timestamptz not null default now()
);
create index manual_expense_other_owner_date_idx on public.manual_expense_other (owner_id, expense_date desc);
create index manual_expense_other_owner_category_idx on public.manual_expense_other (owner_id, category);
alter table public.manual_expense_other enable row level security;
create policy manual_expense_other_owner_all on public.manual_expense_other for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- =========================================================
-- Storage bucket: expense-attachments (private, owner-scoped)
-- Run separately in Supabase dashboard OR via SQL editor:
--
-- insert into storage.buckets (id, name, public) values ('expense-attachments', 'expense-attachments', false);
--
-- create policy expense_attachments_owner_select on storage.objects for select
--   using (bucket_id = 'expense-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy expense_attachments_owner_insert on storage.objects for insert
--   with check (bucket_id = 'expense-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy expense_attachments_owner_update on storage.objects for update
--   using (bucket_id = 'expense-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- create policy expense_attachments_owner_delete on storage.objects for delete
--   using (bucket_id = 'expense-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
-- =========================================================
