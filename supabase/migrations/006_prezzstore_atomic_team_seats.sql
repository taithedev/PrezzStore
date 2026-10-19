-- Guard against concurrent invitations exceeding the earned tier seat cap.
create or replace function public.prezzstore_assign_collaborator(
 p_store uuid,p_user uuid,p_role text,p_limit integer
) returns boolean language plpgsql security definer set search_path=public as $$
declare existing boolean; total integer;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
 then raise exception 'Service role only'; end if;
 if p_role not in ('manager','reviewer','creator') or p_limit not between 1 and 10
 then raise exception 'Invalid assignment';end if;
 -- Serialize invitations per store.
 perform 1 from public.prezzstore_stores where id=p_store for update;
 if not found then return false;end if;
 select exists(select 1 from public.prezzstore_store_managers
   where store_id=p_store and user_id=p_user) into existing;
 select count(*) into total from public.prezzstore_store_managers where store_id=p_store;
 if not existing and total>=p_limit then return false;end if;
 insert into public.prezzstore_store_managers(store_id,user_id,role)
 values(p_store,p_user,p_role)
 on conflict(store_id,user_id) do update set role=excluded.role;
 return true;
end $$;
revoke all on function public.prezzstore_assign_collaborator(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.prezzstore_assign_collaborator(uuid,uuid,text,integer) to service_role;
