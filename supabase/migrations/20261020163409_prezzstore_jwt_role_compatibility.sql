-- PrezzStore only. Preserve existing orders and other apps in the shared project.
create or replace function public.prezzstore_request_role()
returns text language sql stable security invoker set search_path = '' as $$
 select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
   nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
$$;

CREATE OR REPLACE FUNCTION public.prezzstore_assign_collaborator(p_store uuid, p_user uuid, p_role text, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare existing boolean; total integer;
begin
 if public.prezzstore_request_role() is distinct from 'service_role'
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
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_claim_discount(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare used integer;
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then raise exception 'service_role only'; end if;
 update public.prezzstore_discounts set used_count=used_count+1
  where id=p_id and active=true and (expires_at is null or expires_at>now())
   and (max_uses is null or used_count<max_uses)
 returning used_count into used;
 return found;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_guard_client_store_text()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then
  if (coalesce(new.name,'') || ' ' || coalesce(new.description,'')) ~* '\m(fuck(ing|ed|er|s)?|shit(ty)?|bitch(es)?|cunt|nigg(er|a)s?)\M' then
    raise exception 'Store text requires moderation review';
  end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_guard_store_role_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then
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
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_protect_store_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then
   if new.verified is distinct from old.verified or new.suspended_at is distinct from old.suspended_at
      or new.owner_id is distinct from old.owner_id or new.slug is distinct from old.slug then
     raise exception 'Privileged store attributes are server-managed';
   end if;
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_protect_stripe_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
 if public.prezzstore_request_role() is distinct from 'service_role' and new.stripe_account_id is distinct from old.stripe_account_id then
   raise exception 'Stripe account ID is server-managed';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_release_discount(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then raise exception 'service_role only'; end if;
 update public.prezzstore_discounts set used_count=greatest(0,used_count-1) where id=p_id;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_release_stock(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o record;
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then raise exception 'Service role only'; end if;
 select id,product_id,status,stock_reserved into o from public.prezzstore_orders where id=p_order_id for update;
 if found and o.stock_reserved and o.status<>'paid' then
  update public.prezzstore_products set stock_quantity=stock_quantity+1 where id=o.product_id;
  update public.prezzstore_orders set stock_reserved=false where id=o.id;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_require_creator_for_studio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
 if public.prezzstore_request_role() is distinct from 'service_role'
   and new.is_profile_store=false and not exists(
     select 1 from public.prezzstore_user_profiles p where p.user_id=new.owner_id and p.creator_enrolled=true
   ) then raise exception 'Join the PrezzStore Creator Program before opening a studio';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_reserve_stock(p_order_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o record; p record;
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then raise exception 'Service role only'; end if;
 select id,product_id,status,stock_reserved into o from public.prezzstore_orders where id=p_order_id for update;
 if not found or o.status<>'pending' then return false; end if;
 if o.stock_reserved then return true; end if;
 select id,stock_quantity into p from public.prezzstore_products where id=o.product_id for update;
 if p.stock_quantity is not null then
  if p.stock_quantity<1 then return false; end if;
  update public.prezzstore_products set stock_quantity=stock_quantity-1 where id=p.id;
  update public.prezzstore_orders set stock_reserved=true where id=o.id;
 end if;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION public.prezzstore_sync_order_points(p_order_id uuid, p_refund boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o record; earning integer;
begin
 if public.prezzstore_request_role() is distinct from 'service_role' then
  raise exception 'Service role only';
 end if;
 select id,buyer_id,amount_cents,status into o from public.prezzstore_orders where id=p_order_id for update;
 if not found then raise exception 'Missing order for points'; end if;
 earning := floor(o.amount_cents / 100);
 if p_refund then
  if o.status<>'refunded' then raise exception 'Order not refunded'; end if;
  if earning>0 and exists(select 1 from public.prezzstore_point_events where order_id=o.id and reason='purchase') then
   insert into public.prezzstore_point_events(user_id,order_id,reason,points)
   values(o.buyer_id,o.id,'refund',-earning) on conflict (order_id,reason) do nothing;
  end if;
 elsif o.status='paid' and earning>0 then
  insert into public.prezzstore_point_events(user_id,order_id,reason,points)
  values(o.buyer_id,o.id,'purchase',earning) on conflict (order_id,reason) do nothing;
 end if;
end $function$;

