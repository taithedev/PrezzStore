-- Profiles, verification and reversible studio deletion in shared zuzify project.
alter table public.prezzstore_stores add column if not exists is_profile_store boolean not null default false;
alter table public.prezzstore_stores add column if not exists deleted_at timestamptz;
create unique index if not exists prezzstore_one_profile_store_per_user
 on public.prezzstore_stores(owner_id) where is_profile_store = true;
create index if not exists prezzstore_stores_active_browse
 on public.prezzstore_stores(slug) where deleted_at is null and suspended_at is null;
create index if not exists prezzstore_user_profile_items
 on public.prezzstore_products(store_id,created_at desc);

create table if not exists public.prezzstore_user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Creator' check(char_length(display_name) between 2 and 50),
 bio text not null default '' check(char_length(bio)<=600),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.prezzstore_user_verifications (
 user_id uuid primary key references auth.users(id) on delete cascade,
 verified boolean not null default true,
 verified_at timestamptz not null default now(),
 verified_by uuid references auth.users(id),note text
);
alter table public.prezzstore_user_profiles enable row level security;
alter table public.prezzstore_user_verifications enable row level security;
revoke insert,update,delete on public.prezzstore_user_profiles,public.prezzstore_user_verifications from anon,authenticated;
grant select on public.prezzstore_user_profiles,public.prezzstore_user_verifications to anon,authenticated;
grant select,insert,update,delete on public.prezzstore_user_profiles,public.prezzstore_user_verifications to service_role;
drop policy if exists prezzstore_profiles_public_read on public.prezzstore_user_profiles;
create policy prezzstore_profiles_public_read on public.prezzstore_user_profiles for select to anon,authenticated using(true);
drop policy if exists prezzstore_verifications_public_read on public.prezzstore_user_verifications;
create policy prezzstore_verifications_public_read on public.prezzstore_user_verifications for select to anon,authenticated using(verified=true);

create or replace function public.prezzstore_guard_store_role_fields()
returns trigger language plpgsql set search_path=public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
  if tg_op='INSERT' then
   if new.is_profile_store or new.deleted_at is not null or new.verified then
    raise exception 'Special store settings are server-managed';
   end if;
  else
   if new.is_profile_store is distinct from old.is_profile_store
    or new.deleted_at is distinct from old.deleted_at
    or new.verified is distinct from old.verified
    or new.suspended_at is distinct from old.suspended_at
    or new.owner_id is distinct from old.owner_id then
     raise exception 'Special store settings are server-managed';
   end if;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists prezzstore_guard_store_role_fields on public.prezzstore_stores;
create trigger prezzstore_guard_store_role_fields
 before insert or update on public.prezzstore_stores
 for each row execute function public.prezzstore_guard_store_role_fields();

create or replace function public.prezzstore_profile_item_kind_guard()
returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.prezzstore_stores s where s.id=new.store_id and s.is_profile_store)
 and new.kind='membership' then raise exception 'Memberships are available only in studios'; end if;
 return new;
end $$;
drop trigger if exists prezzstore_profile_item_kind_guard on public.prezzstore_products;
create trigger prezzstore_profile_item_kind_guard
 before insert or update of store_id,kind on public.prezzstore_products
 for each row execute function public.prezzstore_profile_item_kind_guard();
revoke delete on public.prezzstore_stores from anon,authenticated;
