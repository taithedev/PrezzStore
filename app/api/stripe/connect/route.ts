import { NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { createRecipient, createOnboardingLink, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";

// Return actionable, non-sensitive Stripe errors to the seller. Never return API keys,
// raw Stripe requests or identifying onboarding information to the browser.
function describeOnboardingFailure(error: unknown): { message: string; code: string; status: number } {
  const details = error && typeof error === "object"
    ? error as { code?: unknown; statusCode?: unknown; type?: unknown }
    : {};
  const code = typeof details.code === "string" && /^[a-z0-9_]{1,90}$/.test(details.code)
    ? details.code : "onboarding_failed";
  const statusCode = typeof details.statusCode === "number" ? details.statusCode : 0;
  if (code === "42501") {
    return {
      code,
      status: 503,
      message: "PrezzStore database access was denied. The server role requires SELECT and UPDATE permissions on the PrezzStore store table. Contact the site administrator."
    };
  }
  if ([
    "platform_registration_required", "connect_profile_not_submitted",
    "account_create_activation_required", "connect_identity_not_verified",
    "cannot_create_connected_account", "account_creation_liability_unacknowledged",
    "account_creation_requirement_collection_unacknowledged"
  ].includes(code)) {
    return { code, status: 503, message: "Stripe Connect needs platform setup or verification. Open Stripe Dashboard → Connect and complete the required steps with an eligible account representative." };
  }
  if ([
    "account_creation_identity_verification_incomplete",
    "date_of_birth_age_restriction",
    "account_creation_liability_unacknowledged_and_identity_verification_incomplete"
  ].includes(code)) {
    return { code, status: 403, message: "Stripe requires identity or age eligibility verification before seller onboarding. Complete Stripe's required process, including a parent or legal guardian where applicable." };
  }
  if (code === "account_creation_blocked_due_to_suspicious_activity") {
    return { code, status: 503, message: "Stripe temporarily restricted connected-account creation. Review the security verification request in your Stripe Dashboard." };
  }
  if (["accounts_v2_access_blocked", "non_connect_platform_accounts_v2_access_blocked"].includes(code)) {
    return { code, status: 503, message: "This request used an outdated Stripe Accounts v2 deployment. Retry the updated seller onboarding flow. Stripe still requires Connect platform registration." };
  }
  if (["accounts_v1_access_blocked", "accounts_v1_creation_not_supported", "account_creation_not_supported", "accounts_v1_creation_not_allowed", "accounts_v1_no_longer_recommended"].includes(code)) {
    return { code, status: 503, message: "Stripe has not enabled Accounts v1 for this sandbox. An eligible platform representative must review Stripe Connect setup and request or enable Accounts v1 support only if Stripe allows it for this integration." };
  }
  if (["permission_error", "api_key_expired", "invalid_api_key"].includes(code) || statusCode === 401 || statusCode === 403) {
    return { code, status: 503, message: "Stripe rejected the server API key or its Connect permissions. Check the sandbox Stripe key and connected-account permissions in Vercel and Stripe." };
  }
  if (code !== "onboarding_failed") {
    return { code, status: 502, message: "Stripe could not create the seller account. Check the Stripe Dashboard request log for error code: " + code + "." };
  }
  return { code, status: 502, message: "Seller onboarding could not start. Review the Stripe Connect setup and Vercel server logs; no account has been linked yet." };
}

export async function POST() {
  const user = await currentUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in to manage your store." }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: "Stripe sandbox is not configured yet." }, { status: 503 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Server database access is not configured." }, { status: 503 });
  try {
    const db = admin();
    const { data: store, error: lookupError } = await db.from("prezzstore_stores")
      .select("id,name,stripe_account_id").eq("owner_id", user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!store) return NextResponse.json({ error: "Create your store before connecting Stripe." }, { status: 404 });
    let accountId: string = store.stripe_account_id ?? "";
    if (!accountId) {
      accountId = await createRecipient(user.email, store.name, store.id);
      const { data: claimed, error: saveError } = await db.from("prezzstore_stores")
        .update({ stripe_account_id: accountId })
        .eq("id", store.id).eq("owner_id", user.id)
        .is("stripe_account_id", null).select("stripe_account_id").maybeSingle();
      if (saveError) throw saveError;
      if (!claimed) {
        // Another onboarding request may have stored the account first.
        const { data: current } = await db.from("prezzstore_stores")
          .select("stripe_account_id").eq("id", store.id).maybeSingle();
        if (!current?.stripe_account_id) throw new Error("Could not verify connected Stripe account");
        accountId = current.stripe_account_id;
      }
    }
    const url = await createOnboardingLink(accountId);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = describeOnboardingFailure(error);
    const stripeError = error && typeof error === "object"
      ? error as { type?: string; requestId?: string; statusCode?: number; message?: string }
      : {};
    console.error("Seller onboarding:", {
      code: failure.code,
      type: stripeError.type,
      statusCode: stripeError.statusCode,
      requestId: stripeError.requestId,
      message: stripeError.message
    });
    return NextResponse.json({ error: failure.message, code: failure.code }, {
      status: failure.status, headers: { "Cache-Control": "no-store" }
    });
  }
}