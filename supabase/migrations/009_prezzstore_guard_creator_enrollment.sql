drop policy if exists prezzstore_owner_creates_own_store on public.prezzstore_stores;
create policy prezzstore_owner_creates_own_store on public.prezzstore_stores
for insert to authenticated with check (
 owner_id=auth.uid() and stripe_account_id is null
 and is_profile_store=false and deleted_at is null
 and exists(select 1 from public.prezzstore_user_profiles p
 where p.user_id=auth.uid() and p.creator_enrolled=true)
);
create or replace function public.prezzstore_require_creator_for_studio()
returns trigger language plpgsql set search_path=public as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 and new.is_profile_store=false and not exists(
  select 1 from public.prezzstore_user_profiles p where p.user_id=new.owner_id and p.creator_enrolled=true
 ) then raise exception 'Join the PrezzStore Creator Program before opening a studio';
 end if;
 return new;
end $$;
drop trigger if exists prezzstore_require_creator_for_studio on public.prezzstore_stores;
create trigger prezzstore_require_creator_for_studio before insert on public.prezzstore_stores
for each row execute function public.prezzstore_require_creator_for_studio();