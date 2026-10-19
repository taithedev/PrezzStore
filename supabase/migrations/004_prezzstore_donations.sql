-- Isolated voluntary PrezzStore platform contributions. No donor personal data is public.
create table if not exists public.prezzstore_donations (
  id uuid primary key default gen_random_uuid(),
  amount_cents integer not null check (amount_cents between 100 and 50000),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists prezzstore_donations_status_created_idx
  on public.prezzstore_donations(status, created_at desc);

alter table public.prezzstore_donations enable row level security;
-- Nothing in this table can be read or written with public or user JWTs.
revoke all on table public.prezzstore_donations from anon, authenticated;
grant select, insert, update on table public.prezzstore_donations to service_role;
