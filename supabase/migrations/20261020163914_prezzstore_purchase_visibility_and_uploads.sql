-- Public browsing excludes archived, removed and suspended listings.
alter policy prezzstore_published_products_or_own_products_are_readable on public.prezzstore_products
using (
 (published and removed_at is null and exists(
  select 1 from public.prezzstore_stores s where s.id=store_id and s.suspended_at is null and s.deleted_at is null))
 or exists(select 1 from public.prezzstore_stores s where s.id=store_id and s.owner_id=(select auth.uid()))
);
create policy prezzstore_buyers_read_purchased_products on public.prezzstore_products
for select to authenticated using (
 exists(select 1 from public.prezzstore_orders o where o.product_id=prezzstore_products.id
  and o.buyer_id=(select auth.uid()) and o.status in ('paid','refunded'))
);
revoke insert,update,delete on public.prezzstore_products from anon,authenticated;
create index if not exists prezzstore_orders_buyer_product_idx on public.prezzstore_orders(buyer_id,product_id);
create policy prezzstore_owners_read_deliveries on storage.objects for select to authenticated
 using(bucket_id='prezzstore_deliveries' and (storage.foldername(name))[1]=(select auth.uid())::text);
alter policy prezzstore_owners_update_deliveries on storage.objects
 using(bucket_id='prezzstore_deliveries' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='prezzstore_deliveries' and (storage.foldername(name))[1]=(select auth.uid())::text);
alter policy prezzstore_owners_edit_assets on storage.objects
 using(bucket_id='prezzstore_assets' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='prezzstore_assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
notify pgrst,'reload schema';
