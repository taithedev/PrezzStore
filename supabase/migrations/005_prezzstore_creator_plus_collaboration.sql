-- Store collaborator roles and earned PrezzCreator+ metrics
alter table public.prezzstore_store_managers add column if not exists role text not null default 'manager';
alter table public.prezzstore_store_managers drop constraint if exists prezzstore_store_managers_role_check;
alter table public.prezzstore_store_managers add constraint prezzstore_store_managers_role_check check(role in ('manager','reviewer','creator'));
alter table public.prezzstore_products add column if not exists submitted_by uuid references auth.users(id);
alter table public.prezzstore_products add column if not exists review_status text not null default 'approved';
alter table public.prezzstore_products drop constraint if exists prezzstore_products_review_status_check;
alter table public.prezzstore_products add constraint prezzstore_products_review_status_check check(review_status in ('pending','approved','changes_requested'));
update public.prezzstore_products p set submitted_by=coalesce(p.asset_owner_id,s.owner_id)
from public.prezzstore_stores s where p.store_id=s.id and p.submitted_by is null;
create index if not exists prezzstore_program_order_eligibility_idx on public.prezzstore_orders(seller_id,created_at)
where status='paid' and stripe_session_id is not null;
create index if not exists prezzstore_program_published_idx on public.prezzstore_products(store_id)
where published=true and removed_at is null;
create index if not exists prezzstore_collaborator_role_idx on public.prezzstore_store_managers(user_id,role);

create or replace function public.prezzstore_creator_plus_status(p_store uuid)
returns table(sales_30d_cents bigint,sales_30d_count bigint,unique_buyers_30d bigint,
published_listings bigint,store_age_days integer,active_store boolean,qualified boolean)
language sql stable security definer set search_path=public,auth as $$
with target as (select id,owner_id,created_at,suspended_at from public.prezzstore_stores where id=p_store),
gross as (
select coalesce(sum(o.amount_cents),0)::bigint revenue,count(*)::bigint purchases,count(distinct o.buyer_id)::bigint buyers
from public.prezzstore_orders o join public.prezzstore_products p on p.id=o.product_id
join target s on s.id=p.store_id and o.seller_id=s.owner_id
where o.status='paid' and o.stripe_session_id is not null and o.amount_cents>0
and o.created_at>=now()-interval '30 days'),
inventory as (select count(*)::bigint listed from public.prezzstore_products p
join target s on s.id=p.store_id where p.published=true and p.removed_at is null)
select g.revenue,g.purchases,g.buyers,i.listed,
greatest(0,floor(extract(epoch from (now()-s.created_at))/86400))::integer,
s.suspended_at is null,
s.suspended_at is null and s.created_at<=now()-interval '14 days'
and g.revenue>=5000 and g.purchases>=3 and g.buyers>=2 and i.listed>=2
from target s cross join gross g cross join inventory i $$;
revoke all on function public.prezzstore_creator_plus_status(uuid) from public,anon,authenticated;
grant execute on function public.prezzstore_creator_plus_status(uuid) to service_role;
