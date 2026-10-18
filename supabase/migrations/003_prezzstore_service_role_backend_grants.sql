-- The dedicated PrezzStore tables use explicit PostgREST role grants.
-- Preserve existing RLS and provide only the privileges needed by server-side payment routes.
-- Fixes PostgreSQL error 42501 (insufficient_privilege) during Stripe Connect onboarding.
--
-- Seller Connect routes read/update the store's stripe_account_id.
grant select, update on table public.prezzstore_stores to service_role;
-- Checkout and protected downloads read product metadata.
grant select on table public.prezzstore_products to service_role;
-- Checkout and verified Stripe webhooks insert/update orders; buyer downloads read them.
grant select, insert, update on table public.prezzstore_orders to service_role;
-- Never expose SUPABASE_SERVICE_ROLE_KEY in the browser or NEXT_PUBLIC_ environment variables.
-- Do not grant buyers direct INSERT or UPDATE access to orders.
