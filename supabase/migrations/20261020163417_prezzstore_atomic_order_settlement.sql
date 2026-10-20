alter function public.prezzstore_protect_stripe_id() set search_path = public;
alter table public.prezzstore_orders
 add column if not exists discount_claimed boolean not null default false,
 add column if not exists stripe_payment_intent_id text,
 add column if not exists product_title text,
 add column if not exists store_name text,
 add column if not exists product_kind text,
 add column if not exists delivery_file_path text,
 add column if not exists delivery_asset_owner_id uuid,
 add column if not exists fulfillment_note text;

create index if not exists prezzstore_orders_payment_intent_idx
 on public.prezzstore_orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create or replace function public.prezzstore_claim_order_discount(p_order_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare o public.prezzstore_orders%rowtype;
begin
 select * into o from public.prezzstore_orders where id=p_order_id for update;
 if not found or o.status<>'pending' then return false; end if;
 if o.discount_id is null or o.discount_claimed then return true; end if;
 if not public.prezzstore_claim_discount(o.discount_id) then return false; end if;
 update public.prezzstore_orders set discount_claimed=true where id=o.id;
 return true;
end;
$$;
revoke all on function public.prezzstore_claim_order_discount(uuid) from public,anon,authenticated;
grant execute on function public.prezzstore_claim_order_discount(uuid) to service_role;

create or replace function public.prezzstore_settle_order(
 p_order_id uuid, p_status text, p_session_id text default null,
 p_buyer_id uuid default null, p_amount integer default null,
 p_subscription_id text default null, p_payment_intent_id text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare o public.prezzstore_orders%rowtype;
begin
 select * into o from public.prezzstore_orders where id=p_order_id for update;
 if not found then raise exception 'Unknown order'; end if;
 if p_status not in ('paid','failed','refunded') then raise exception 'Invalid transition'; end if;
 if p_session_id is not null and o.stripe_session_id is distinct from p_session_id then
  raise exception 'Checkout session does not match';
 end if;
 if p_status='paid' then
  if o.amount_cents>0 then
   if p_session_id is null or p_buyer_id is distinct from o.buyer_id
     or p_amount is distinct from o.amount_cents then raise exception 'Payment does not match'; end if;
  elsif p_session_id is not null then raise exception 'Free order cannot use paid checkout';
  end if;
  if o.status='refunded' then return false; end if;
  if o.status not in ('pending','paid') then raise exception 'Order cannot be fulfilled'; end if;
  if o.status='pending' then
   update public.prezzstore_orders set status='paid',
    stripe_subscription_id=p_subscription_id,
    stripe_payment_intent_id=p_payment_intent_id,
    membership_status=case when p_subscription_id is null then 'inactive' else 'active' end
    where id=o.id;
  end if;
  perform public.prezzstore_sync_order_points(o.id,false);
  return true;
 elsif p_status='failed' then
  if o.status not in ('pending','failed') then return false; end if;
  update public.prezzstore_orders set status='failed' where id=o.id;
  perform public.prezzstore_release_stock(o.id);
  if o.discount_claimed and o.discount_id is not null then
   perform public.prezzstore_release_discount(o.discount_id);
   update public.prezzstore_orders set discount_claimed=false where id=o.id;
  end if;
  return true;
 else
  if p_session_id is null or o.status not in ('paid','refunded') then return false; end if;
  update public.prezzstore_orders set status='refunded',membership_status='inactive' where id=o.id;
  perform public.prezzstore_sync_order_points(o.id,true);
  perform public.prezzstore_release_stock(o.id);
  return true;
 end if;
end;
$$;
revoke all on function public.prezzstore_settle_order(uuid,text,text,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.prezzstore_settle_order(uuid,text,text,uuid,integer,text,text) to service_role;

create or replace function public.prezzstore_claim_receipt(p_order_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare claimed uuid;
begin
 if not exists(select 1 from public.prezzstore_orders where id=p_order_id and status='paid') then return false; end if;
 insert into public.prezzstore_order_receipt_emails(order_id,status,updated_at)
 values(p_order_id,'sending',now())
 on conflict(order_id) do update set status='sending',updated_at=now()
 where prezzstore_order_receipt_emails.status='failed'
    or (prezzstore_order_receipt_emails.status='sending' and prezzstore_order_receipt_emails.updated_at<now()-interval '10 minutes')
 returning order_id into claimed;
 return claimed is not null;
end;
$$;
revoke all on function public.prezzstore_claim_receipt(uuid) from public,anon,authenticated;
grant execute on function public.prezzstore_claim_receipt(uuid) to service_role;

