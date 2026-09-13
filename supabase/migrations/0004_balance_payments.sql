-- Run this after the earlier migrations in an existing Supabase project.
-- It records partial and full payments against pairwise household balances.
create table if not exists public.balance_payments (
  id uuid primary key,
  payer_id text not null references public.roommates(id),
  recipient_id text not null references public.roommates(id),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  check (payer_id <> recipient_id)
);
create index if not exists balance_payments_created_at on public.balance_payments (created_at desc);

alter table public.balance_payments enable row level security;
create policy "members can access balance payments" on public.balance_payments for all to authenticated using (public.is_app_member()) with check (public.is_app_member());
