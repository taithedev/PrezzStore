import Stripe from "stripe";

let client: Stripe | undefined;
/** Uses a server-only restricted Stripe key. Real payments require an explicit separate launch decision. */
export function stripe(): Stripe {
  const key = (process.env.STRIPE_SECRET_KEY || process.env.PREZZSTORE_STRIPE_SECRET_KEY);
  if (!key) throw new Error("Stripe sandbox key has not been configured");
  if (key.includes("_live_") && process.env.PREZZSTORE_LIVE_PAYMENTS_ENABLED !== "true") {
    throw new Error("Live Stripe payments are disabled until the marketplace is approved for launch");
  }
  return (client ??= new Stripe(key, { apiVersion: "2026-08-26.dahlia" }));
}

export function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY || process.env.PREZZSTORE_STRIPE_SECRET_KEY;
  return Boolean(key && (key.includes("_test_") || (key.includes("_live_") && process.env.PREZZSTORE_LIVE_PAYMENTS_ENABLED === "true")));
}

export function siteUrl(): string {
  const supplied = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL;
  if (!supplied) throw new Error("Set NEXT_PUBLIC_SITE_URL to your site HTTPS origin");
  const url = new URL(supplied.startsWith("http") ? supplied : "https://" + supplied);
  if (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:")) {
    throw new Error("Site URL must be HTTPS");
  }
  return url.origin;
}

export async function marketplaceFeeBps(): Promise<number> {
  const { admin } = await import("@/lib/supabase");
  const { data, error } = await admin().from("prezzstore_platform_settings")
    .select("number_value").eq("name","commission_bps").single();
  if(error)throw error;
  const fee = data?.number_value;
  if(!Number.isInteger(fee) || fee<0 || fee>3000)throw new Error("Invalid commission setting");
  return fee;
}
/** Legacy environment fallback retained for separate deployments that haven't migrated. */
export function feeBps(): number {
  const value = Number(process.env.PREZZSTORE_PLATFORM_FEE_BPS ?? "1000");
  if (!Number.isInteger(value) || value < 0 || value > 3000) {
    throw new Error("Invalid PrezzStore platform fee");
  }
  return value;
}

export type RecipientStatus = "active" | "pending" | "inactive";

export async function recipientStatus(accountId: string): Promise<RecipientStatus> {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) return "inactive";
  // The connected marketplace uses the Accounts v1 controller-properties API
  // because Stripe has not enabled Accounts v2 for this platform.
  const account = await stripe().accounts.retrieve(accountId);
  const transfers = account.capabilities?.transfers;
  // A transfer capability alone does not prove the seller can be paid out.
  if (transfers === "active" && account.payouts_enabled) return "active";
  if (
    transfers === "pending" ||
    (account.requirements?.currently_due?.length ?? 0) > 0 ||
    (account.requirements?.pending_verification?.length ?? 0) > 0 ||
    account.requirements?.disabled_reason?.startsWith("requirements.")
  ) return "pending";
  return "inactive";
}

export async function createRecipient(email: string, displayName: string, storeId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) throw new Error("Invalid store identifier");
  // Official Stripe Accounts v1 controller-properties API. This still requires
  // Connect registration and Stripe identity / eligibility verification.
  // No identity information is invented or marked as verified by the platform.
  const account = await stripe().accounts.create({
    email,
    country: (process.env.STRIPE_CONNECT_COUNTRY || "US").toUpperCase(),
    controller: {
      stripe_dashboard: { type: "express" },
      fees: { payer: "application" },
      losses: { payments: "application" },
      requirement_collection: "stripe"
    },
    capabilities: { transfers: { requested: true } },
    metadata: { prezzstore_store_id: storeId, prezzstore_store_name: displayName.slice(0, 100) }
  }, { idempotencyKey: "prezzstore_seller_v1_" + storeId });
  return account.id;
}

export async function createOnboardingLink(accountId: string, storeId?:string): Promise<string> {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new Error("Invalid Stripe account identifier");
  const url = siteUrl();
  const studioQuery=storeId&&/^[0-9a-f-]{36}$/i.test(storeId)?"?store_id="+storeId:"";
  const result = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: url + "/api/stripe/connect/refresh" + studioQuery,
    return_url: url + "/dashboard?stripe=returned" + (storeId?"&store="+storeId:"")
  });
  return result.url;
}
