-- Store personal appearance settings in the existing shared Supabase project.
create table if not exists public.prezzstore_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 theme text not null default 'oled' check (theme in ('oled','soft','contrast')),
 effect text not null default 'none' check (effect in ('none','snow','stars')),
 density text not null default 'comfortable' check (density in ('comfortable','compact')),
 intensity smallint not null default 2 check (intensity between 1 and 5),
 reduce_motion boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.prezzstore_preferences enable row level security;
create policy prezzstore_preferences_own_read on public.prezzstore_preferences
 for select to authenticated using (user_id = (select auth.uid()));
create policy prezzstore_preferences_own_insert on public.prezzstore_preferences
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy prezzstore_preferences_own_update on public.prezzstore_preferences
 for update to authenticated using (user_id = (select auth.uid()))
 with check (user_id = (select auth.uid()));
grant select,insert,update on public.prezzstore_preferences to authenticated;
revoke all on public.prezzstore_preferences from anon;
create index if not exists prezzstore_orders_product_idx on public.prezzstore_orders(product_id);
