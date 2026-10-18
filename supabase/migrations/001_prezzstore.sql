-- Dedicated PrezzStore tables in the shared zuzify project; does not touch other apps.
create extension if not exists pgcrypto;
create table if not exists public.prezzstore_stores (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 70),
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
 description text check (char_length(description) <= 1500),
 accent text not null default '#9271ff' check (accent ~ '^#[0-9a-fA-F]{6}$'),
 banner_url text, avatar_url text,
 stripe_account_id text unique,
 created_at timestamptz not null default now()
);
create table if not exists public.prezzstore_products (
 id uuid primary key default gen_random_uuid(),
 store_id uuid not null references public.prezzstore_stores(id) on delete cascade,
 title text not null check (char_length(title) between 3 and 120),
 slug text not null check (slug ~ '^[a-z0-9-]{3,100}$'),
 description text check (char_length(description)<=10000),
 category text not null default 'Other',
 image_url text,
 price_cents integer not null check(price_cents between 100 and 50000000),
 kind text not null default 'digital' check(kind in ('digital','membership')),
 file_path text,
 published boolean not null default false,
 created_at timestamptz not null default now(),
 unique(store_id,slug)
);
create table if not exists public.prezzstore_orders (
 id uuid primary key default gen_random_uuid(),
 buyer_id uuid not null references auth.users(id) on delete cascade,
 seller_id uuid not null references auth.users(id),
 product_id uuid not null references public.prezzstore_products(id),
 amount_cents integer not null check(amount_cents>0),
 status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
 membership_status text not null default 'inactive' check(membership_status in ('active','inactive')),
 stripe_session_id text unique,
 stripe_subscription_id text,
 created_at timestamptz not null default now()
);
create index if not exists prezzstore_products_browse_idx on public.prezzstore_products(published,created_at desc);
create index if not exists prezzstore_orders_buyer_idx on public.prezzstore_orders(buyer_id,created_at desc);
create index if not exists prezzstore_orders_seller_idx on public.prezzstore_orders(seller_id,created_at desc);
alter table public.prezzstore_stores enable row level security;
alter table public.prezzstore_products enable row level security;
alter table public.prezzstore_orders enable row level security;
create policy "prezzstore_stores_are_public" on public.prezzstore_stores for select using(true);
create policy "prezzstore_owner_creates_own_store" on public.prezzstore_stores for insert to authenticated with check(owner_id=auth.uid() and stripe_account_id is null);
create policy "prezzstore_owner_edits_store" on public.prezzstore_stores for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "prezzstore_published_products_or_own_products_are_readable" on public.prezzstore_products for select using(published or exists(select 1 from public.prezzstore_stores s where s.id=store_id and s.owner_id=auth.uid()));
create policy "prezzstore_owners_create_products" on public.prezzstore_products for insert to authenticated with check(exists(select 1 from public.prezzstore_stores s where s.id=store_id and s.owner_id=auth.uid()));
create policy "prezzstore_owners_modify_products" on public.prezzstore_products for update to authenticated using(exists(select 1 from public.prezzstore_stores s where s.id=store_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.prezzstore_stores s where s.id=store_id and s.owner_id=auth.uid()));
create policy "prezzstore_owners_delete_products" on public.prezzstore_products for delete to authenticated using(exists(select 1 from public.prezzstore_stores s where s.id=store_id and s.owner_id=auth.uid()));
create policy "prezzstore_buyers_and_sellers_see_orders" on public.prezzstore_orders for select to authenticated using(buyer_id=auth.uid() or seller_id=auth.uid());
-- Orders and Stripe fields are written ONLY by server with service role. Never grant client order writes.
-- Prevent owner from changing or fabricating Stripe connected account IDs via client update.
create or replace function public.prezzstore_protect_stripe_id() returns trigger language plpgsql as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' and new.stripe_account_id is distinct from old.stripe_account_id then
   raise exception 'Stripe account ID is server-managed';
 end if;
 return new;
end $$;
drop trigger if exists prezzstore_protect_stripe_id on public.prezzstore_stores;
create trigger prezzstore_protect_stripe_id before update on public.prezzstore_stores for each row execute function public.prezzstore_protect_stripe_id();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('prezzstore_assets','prezzstore_assets',true,5242880,array['image/jpeg','image/png','image/webp','image/gif']),
 ('prezzstore_deliveries','prezzstore_deliveries',false,52428800,null)
on conflict (id) do nothing;
create policy "prezzstore_public_images" on storage.objects for select using(bucket_id='prezzstore_assets');
create policy "prezzstore_owners_upload_assets" on storage.objects for insert to authenticated with check(bucket_id='prezzstore_assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prezzstore_owners_edit_assets" on storage.objects for update to authenticated using(bucket_id='prezzstore_assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prezzstore_owners_delete_assets" on storage.objects for delete to authenticated using(bucket_id='prezzstore_assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prezzstore_owners_upload_deliveries" on storage.objects for insert to authenticated with check(bucket_id='prezzstore_deliveries' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prezzstore_owners_update_deliveries" on storage.objects for update to authenticated using(bucket_id='prezzstore_deliveries' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "prezzstore_owners_delete_deliveries" on storage.objects for delete to authenticated using(bucket_id='prezzstore_deliveries' and (storage.foldername(name))[1] = auth.uid()::text);
-- No client SELECT policy for private deliveries; only authenticated server-generated 60-second signed URLs.
grant select on public.prezzstore_stores to anon, authenticated;
grant insert, update on public.prezzstore_stores to authenticated;
grant select on public.prezzstore_products to anon, authenticated;
grant insert, update, delete on public.prezzstore_products to authenticated;
grant select on public.prezzstore_orders to authenticated;
revoke insert, update, delete on public.prezzstore_orders from anon, authenticated;
