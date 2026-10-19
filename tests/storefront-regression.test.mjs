import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("dashboard reads isolated PrezzStore store and listing tables",()=>{
 const s=read("app/dashboard/page.tsx");
 assert.match(s,/from\("prezzstore_stores"\)/);
 assert.match(s,/from\("prezzstore_products"\)/);
 assert.doesNotMatch(s,/from\("prezz_stores"\)|from\("prezz_products"\)/);
});
test("seller listing changes verify ownership and restrict editable fields",()=>{
 const s=read("app/api/studio/products/[id]/route.ts");
 assert.match(s,/currentUser\(\)/);
 assert.match(s,/\.eq\("owner_id",user.id\)/);
 assert.doesNotMatch(s,/updates\.file_path\s*=/);
 assert.doesNotMatch(s,/updates\.store_id\s*=/);
});
test("downloads require paid orders and seller-owned file paths",()=>{
 const s=read("app/api/download/[id]/route.ts");
 assert.match(s,/order.status!=="paid"/);
 assert.match(s,/product.file_path.startsWith\(order.seller_id\+"\/"\)/);
});
test("Stripe requires signing secret for checkout and live launch is gated",()=>{
 const s=read("app/api/checkout/route.ts"),keys=read("lib/stripe.ts");
 assert.match(s,/process.env.STRIPE_WEBHOOK_SECRET/);
 assert.match(keys,/PREZZSTORE_STRIPE_SECRET_KEY/);
 assert.match(keys,/PREZZSTORE_LIVE_PAYMENTS_ENABLED/);
});
test("saved preferences are authenticated and row scoped",()=>{
 const s=read("app/api/preferences/route.ts");
 assert.match(s,/currentUser\(\)/);
 assert.match(s,/user_id",user.id/);
 assert.match(s,/user_id:user.id/);
});
test("appearance supports OLED black, snow, stars and motion preferences",()=>{
 const s=read("components/appearance-panel.tsx");
 assert.match(s,/OLED Black/);
 assert.match(s,/snow/);
 assert.match(s,/stars/);
 assert.match(s,/reduce_motion/);
});

test("Stripe seller onboarding returns actionable errors and preserves account retries",()=>{
 const route=read("app/api/stripe/connect/route.ts");
 const stripe=read("lib/stripe.ts");
 assert.match(route,/platform_registration_required/);
 assert.match(route,/connect_identity_not_verified/);
 assert.match(route,/account_creation_identity_verification_incomplete/);
 assert.match(route,/permission_error/);
 assert.match(route,/stripeError\.requestId/);
 assert.match(route,/createRecipient\(user\.email, store\.name, store\.id\)/);
 assert.doesNotMatch(route,/Unable to start Stripe onboarding\. Check sandbox/);
 assert.match(stripe,/idempotencyKey: "prezzstore_seller_v1_" \+ storeId/);
 assert.match(stripe,/stripe\(\)\.accountLinks\.create/);
 assert.match(stripe,/stripe\(\)\.accounts\.create/);
 assert.match(stripe,/stripe\(\)\.accounts\.retrieve/);
 assert.match(stripe,/stripe_dashboard: \{ type: "express" \}/);
 assert.match(stripe,/capabilities: \{ transfers: \{ requested: true \} \}/);
 assert.match(stripe,/account\.payouts_enabled/);
 assert.doesNotMatch(stripe,/stripe\(\)\.v2\.core\.accounts/);
});

test("PrezzStore payment backend has explicit service-role grants",()=>{
 const migration=read("supabase/migrations/003_prezzstore_service_role_backend_grants.sql");
 const connect=read("app/api/stripe/connect/route.ts");
 assert.match(migration,/grant select, update on table public\.prezzstore_stores to service_role;/);
 assert.match(migration,/grant select on table public\.prezzstore_products to service_role;/);
 assert.match(migration,/grant select, insert, update on table public\.prezzstore_orders to service_role;/);
 assert.match(connect,/code === "42501"/);
 assert.match(connect,/PrezzStore database access was denied/);
});

test("Stripe Accounts v1 access errors are actionable without bypassing eligibility checks",()=>{
 const connect=read("app/api/stripe/connect/route.ts");
 assert.match(connect,/accounts_v1_access_blocked/);
 assert.match(connect,/eligible platform representative/);
 assert.match(connect,/account_creation_identity_verification_incomplete/);
 assert.match(connect,/date_of_birth_age_restriction/);
});

test("Onboarding error diagnostics preserve a safe failure stage without secrets",()=>{
 const route=read("app/api/stripe/connect/route.ts");
 assert.match(route,/type OnboardingStep/);
 assert.match(route,/step = "create_seller"/);
 assert.match(route,/step = "save_seller"/);
 assert.match(route,/step = "create_onboarding_link"/);
 assert.match(route,/stripeError\.requestId/);
 assert.match(route,/Stripe says:/);
 assert.match(route,/secret hidden/);
 assert.match(route,/requestId: failure\.requestId/);
});

test("marketplace commission defaults to 10% and supports Stripe Connect splits",()=>{
 const s=read("lib/stripe.ts"),checkout=read("app/api/checkout/route.ts");
 assert.match(s,/PREZZSTORE_PLATFORM_FEE_BPS \\?\\? "1000"/);
 assert.match(checkout,/application_fee_amount/);
 assert.match(checkout,/application_fee_percent/);
 assert.match(checkout,/transfer_data: \\{ destination: store.stripe_account_id \\}/);
});
test("optional platform support payments are validated and webhook-confirmed",()=>{
 const route=read("app/api/donate/route.ts"),webhook=read("app/api/stripe/webhook/route.ts");
 const migration=read("supabase/migrations/004_prezzstore_donations.sql");
 assert.match(route,/parseAmountCents/);
 assert.match(route,/prezzstore_payment_type: "donation"/);
 assert.doesNotMatch(route,/application_fee_amount|transfer_data/);
 assert.match(webhook,/prezzstore_donations/);
 assert.match(webhook,/session.payment_status !== "paid"/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/service_role/);
});
