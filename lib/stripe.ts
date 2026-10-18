import Stripe from "stripe";
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
}
export function siteUrl() {
  const provided = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const url = provided?.startsWith("http") ? provided : provided ? "https://" + provided : "";
  if (!url.startsWith("https://")) throw new Error("HTTPS site URL is not configured");
  return url.replace(/\/$/, "");
}
export function feeBps() {
  const n = Number(process.env.PREZZSTORE_PLATFORM_FEE_BPS || 800);
  if (!Number.isInteger(n) || n < 0 || n > 3000) throw new Error("Invalid platform fee");
  return n;
}
export async function stripeV2<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  const response = await fetch("https://api.stripe.com/v2/core/" + path, {
    method,
    headers: {
      Authorization: "Bearer " + process.env.STRIPE_SECRET_KEY,
      "Stripe-Version": "2026-09-30.preview",
      "Content-Type": "application/json"
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Stripe account request failed");
  return data as T;
}
export type Recipient = { id: string; configuration?: { recipient?: { capabilities?: { stripe_balance?: { stripe_transfers?: {status?: string} } } } } };
export async function transfersActive(accountId: string) {
  const acc = await stripeV2<Recipient>("accounts/" + encodeURIComponent(accountId) + "?include%5B%5D=configuration.recipient");
  return acc.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
}