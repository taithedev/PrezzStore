alter table public.prezzstore_user_profiles add column if not exists creator_enrolled boolean not null default false;
update public.prezzstore_user_profiles p set creator_enrolled=true
 where exists(select 1 from public.prezzstore_stores s where s.owner_id=p.user_id and s.is_profile_store=false);
insert into public.prezzstore_user_profiles(user_id,display_name,creator_enrolled)
 select distinct s.owner_id,'Creator',true from public.prezzstore_stores s where s.is_profile_store=false
on conflict(user_id) do update set creator_enrolled=true;
create index if not exists prezzstore_creator_enrollment_idx on public.prezzstore_user_profiles(creator_enrolled)
 where creator_enrolled=true;