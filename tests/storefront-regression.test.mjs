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
 assert.match(s,/canManageStore\(user,product.store_id\)/);
 assert.doesNotMatch(s,/updates\.file_path\s*=/);
 assert.doesNotMatch(s,/updates\.store_id\s*=/);
});
test("downloads require paid orders and seller-owned file paths",()=>{
 const s=read("app/api/download/[id]/route.ts");
 assert.match(s,/order.status!=="paid"/);
 assert.match(s,/product.asset_owner_id\|\|order.seller_id/);
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
 assert.match(s,/PREZZSTORE_PLATFORM_FEE_BPS/);
 assert.match(s,/"1000"/);
 assert.match(checkout,/application_fee_amount/);
 assert.match(checkout,/application_fee_percent/);
 assert.match(checkout,/transfer_data:/);
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

test("verified storefront management and role controls are server-side",()=>{
 const a=read("lib/authority.ts"),c=read("app/api/control/route.ts");
 assert.match(a,/email_confirmed_at/);
 assert.match(a,/ownerEmails/);
 assert.match(a,/prezzstore_store_managers/);
 assert.match(c,/role!=="owner"/);
 assert.match(c,/prezzstore_verified_user_id/);
});
test("free product fulfillment, discounts and stock are server mediated",()=>{
 const route=read("app/api/checkout/route.ts");
 assert.match(route,/prezzstore_reserve_stock/);
 assert.match(route,/prezzstore_claim_discount/);
 assert.match(route,/finalPrice===0/);
 assert.match(route,/marketplaceFeeBps/);
 assert.match(route,/stock_quantity/);
});
test("authenticated screen receipts and optional email receipts",()=>{
 const page=read("app/orders/receipt/[id]/page.tsx");
 const email=read("lib/receipt-email.ts");
 assert.match(page,/buyer_id",user.id/);
 assert.match(page,/PrintReceipt/);
 assert.match(email,/RESEND_API_KEY/);
 assert.match(email,/prezzstore_order_receipt_emails/);
});
test("homepage uses concise product language rather than template slogans",()=>{
 const page=read("app/page.tsx"),grid=read("components/market-grid.tsx");
 assert.doesNotMatch(page,/YOUR NEXT CHAPTER STARTS HERE|WHY PREZZSTORE|Make something\./);
 assert.doesNotMatch(grid,/MADE BY CREATORS|Find your next favorite thing/);
});

test("Studio roles guard user-visible operations and data",()=>{
 const roles=read("lib/authority.ts"),dashboard=read("app/dashboard/page.tsx"),create=read("app/api/studio/products/route.ts");
 const edit=read("app/api/studio/products/[id]/route.ts"),review=read("app/api/studio/products/[id]/review/route.ts");
 assert.match(roles,/studioRole/);assert.match(roles,/canEditStore/);
 assert.match(dashboard,/studioAccess==="creator"/);
 assert.match(dashboard,/submitted_by",user.id/);
 assert.match(dashboard,/studioAccess==="owner"\|\|studioAccess==="manager"/);
 assert.match(create,/creatorOnly\?false:published/);
 assert.match(edit,/role==="creator"/);
 assert.match(edit,/product.submitted_by!==user.id/);
 assert.match(review,/canApproveProduct/);
 assert.match(review,/moderationReason/);
});
test("PrezzCreator+ fee is computed from verified store performance",()=>{
 const code=read("lib/creator-plus.ts"),checkout=read("app/api/checkout/route.ts");
 const migration=read("supabase/migrations/005_prezzstore_creator_plus_collaboration.sql");
 assert.match(migration,/stripe_session_id is not null/);
 assert.match(migration,/g.revenue>=5000/);
 assert.match(migration,/g.purchases>=3/);
 assert.match(migration,/g.buyers>=2/);
 assert.match(code,/Math.min\(base,500\)/);
 assert.match(code,/qualified\?10:3/);
 assert.match(checkout,/creatorPlusStatus\(product.store_id\)/);
 assert.match(checkout,/creatorPlusFeeBps\(baseBps,qualified\)/);
});
test("Team collaborators require confirmed users and owner authorization",()=>{
 const route=read("app/api/studio/team/route.ts"),roles=read("lib/authority.ts");
 assert.match(route,/canManageTeam\(user,storeId\)/);
 assert.match(route,/prezzstore_verified_user_id/);
 assert.match(route,/prezzstore_assign_collaborator/);
 assert.match(roles,/staff.role/);
});

test("Profile subscriptions remain forbidden server side and in database",()=>{
 const create=read("app/api/studio/products/route.ts");
 const checkout=read("app/api/checkout/route.ts");
 const profile=read("components/profile-listings.tsx");
 const migration=read("supabase/migrations/007_prezzstore_profiles_and_studio_archive.sql");
 assert.match(create,/store.is_profile_store&&kind==="membership"/);
 assert.match(checkout,/store.is_profile_store&&product.kind==="membership"/);
 assert.doesNotMatch(profile,/<option value="membership"/);
 assert.match(migration,/prezzstore_profile_item_kind_guard/);
});
test("Owner may verify profile and studio removal never deletes historical orders",()=>{
 const api=read("app/api/control/route.ts"),del=read("app/api/studio/stores/[id]/route.ts");
 assert.match(api,/action==="verify_user"/);
 assert.match(api,/role!=="owner"/);
 assert.match(del,/confirm_name!==studio.name/);
 assert.match(del,/deleted_at:new Date/);
 assert.doesNotMatch(del,/delete\(\).*from\("prezzstore_orders"\)/);
});
test("Public profile badges are owner role or server verified, never self-assigned",()=>{
 const profile=read("lib/profile.ts"),db=read("supabase/migrations/007_prezzstore_profiles_and_studio_archive.sql");
 assert.match(profile,/prezzstore_platform_roles/);
 assert.match(profile,/prezzstore_user_verifications/);
 assert.match(db,/revoke insert,update,delete/);
});

test("Normal buyers must opt into Creator Program, with separate Creator+ tier",()=>{
 const join=read("app/api/creator/join/route.ts"),dashboard=read("app/dashboard/page.tsx");
 const migration=read("supabase/migrations/009_prezzstore_guard_creator_enrollment.sql");
 const settings=read("app/account/settings/page.tsx");
 assert.match(join,/email_confirmed_at/);
 assert.match(join,/creator_enrolled:true/);
 assert.match(dashboard,/creatorEnrolled\(user\)/);
 assert.match(migration,/creator_enrolled=true/);
 assert.match(settings,/CreatorJoin/);
});
test("Official Zuzify store is featured without fabricated products",()=>{
 const page=read("app/page.tsx");
 assert.match(page,/storeBySlug\("zuzify"\)/);
 assert.match(page,/href="\/shop\/zuzify"/);
 assert.match(page,/zuzify&&/);
});
