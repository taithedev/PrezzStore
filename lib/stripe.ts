import Stripe from "stripe";

let client: Stripe | undefined;
/** Uses a server-only restricted Stripe key. Real payments require an explicit separate launch decision. */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe sandbox key has not been configured");
  if (key.includes("_live_") && process.env.PREZZSTORE_LIVE_PAYMENTS_ENABLED !== "true") {
    throw new Error("Live Stripe payments are disabled until the marketplace is approved for launch");
  }
  return (client ??= new Stripe(key, { apiVersion: "2026-08-26.dahlia" }));
}

export function stripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && (key.includes("_test_") || key.includes("_live_")));
}

export function siteUrl(): string {
  const supplied = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.VERCEL_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!supplied) throw new Error("Set NEXT_PUBLIC_SITE_URL to your site HTTPS origin");
  const url = new URL(supplied.startsWith("http") ? supplied : "https://" + supplied);
  if (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:")) {
    throw new Error("Site URL must be HTTPS");
  }
  return url.origin;
}

export function feeBps(): number {
  const value = Number(process.env.PREZZSTORE_PLATFORM_FEE_BPS ?? "800");
  if (!Number.isInteger(value) || value < 0 || value > 3000) {
    throw new Error("Invalid PrezzStore platform fee");
  }
  return value;
}

export type RecipientStatus = "active" | "pending" | "inactive";

export async function recipientStatus(accountId: string): Promise<RecipientStatus> {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) return "inactive";
  const result = await stripe().v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
  const status = result.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  return status === "active" ? "active" : (status === "pending" ? "pending" : "inactive");
}

export async function createRecipient(email: string, displayName: string): Promise<string> {
  const account = await stripe().v2.core.accounts.create({
    display_name: displayName,
    contact_email: email,
    dashboard: "express",
    identity: { country: (process.env.STRIPE_CONNECT_COUNTRY || "US").toUpperCase() },
    defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
    configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
    include: ["configuration.recipient", "requirements"]
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string): Promise<string> {
  const url = siteUrl();
  const result = await stripe().v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["recipient"],
        refresh_url: url + "/api/stripe/connect/refresh",
        return_url: url + "/dashboard?stripe=returned"
      }
    }
  });
  return result.url;
}