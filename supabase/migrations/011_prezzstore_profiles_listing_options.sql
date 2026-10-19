-- Optional creator identity and listing presentation, scoped to PrezzStore.
alter table public.prezzstore_user_profiles
 add column if not exists username text,
 add column if not exists avatar_url text,
 add column if not exists banner_url text,
 add column if not exists website_url text;
update public.prezzstore_user_profiles
 set username='user_'||left(replace(user_id::text,'-',''),16)
 where username is null;
create or replace function public.prezzstore_default_username()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.username is null then
  new.username:='user_'||left(replace(new.user_id::text,'-',''),16);
 end if;
 return new;
end $$;
drop trigger if exists prezzstore_default_username on public.prezzstore_user_profiles;
create trigger prezzstore_default_username before insert on public.prezzstore_user_profiles
 for each row execute function public.prezzstore_default_username();
alter table public.prezzstore_user_profiles alter column username set not null;
alter table public.prezzstore_user_profiles
 add constraint prezzstore_profile_username_format
 check (username ~ '^[a-z][a-z0-9_]{2,29}$');
create unique index if not exists prezzstore_profile_username_unique
 on public.prezzstore_user_profiles (lower(username));
alter table public.prezzstore_products
 add column if not exists subtitle text,
 add column if not exists gallery_urls text[] not null default '{}',
 add column if not exists tags text[] not null default '{}',
 add column if not exists highlights text[] not null default '{}',
 add column if not exists fulfillment_note text;
alter table public.prezzstore_products
 add constraint prezzstore_products_optional_details
 check (char_length(coalesce(subtitle,''))<=160
   and char_length(coalesce(fulfillment_note,''))<=1200
   and cardinality(gallery_urls)<=5 and cardinality(tags)<=8
   and cardinality(highlights)<=6);
grant select,insert,update on public.prezzstore_user_profiles to service_role;
grant select,insert,update on public.prezzstore_products to service_role;
