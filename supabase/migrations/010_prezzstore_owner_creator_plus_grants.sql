-- Owner-only grants are checked on the server and orders carry a permanent complimentary flag.
create table if not exists public.prezzstore_creator_plus_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now()
);
alter table public.prezzstore_creator_plus_grants enable row level security;
revoke all on public.prezzstore_creator_plus_grants from anon,authenticated;
grant all on public.prezzstore_creator_plus_grants to service_role;
alter table public.prezzstore_orders add column if not exists owner_comped boolean not null default false;
create index if not exists prezzstore_owner_comped_orders_idx on public.prezzstore_orders(buyer_id,created_at desc) where owner_comped=true;
