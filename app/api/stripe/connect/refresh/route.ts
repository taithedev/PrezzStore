import { NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { createOnboardingLink, siteUrl, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const fail = () => NextResponse.redirect(new URL("/dashboard?stripe=error", origin));
  try {
    const user = await currentUser();
    if (!user) return NextResponse.redirect(new URL("/login?next=/dashboard", origin));
    if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return fail();
    const { data: store, error } = await admin().from("prezzstore_stores")
      .select("stripe_account_id").eq("owner_id", user.id).maybeSingle();
    if (error || !store?.stripe_account_id) return fail();
    siteUrl(); // Validate configured origin before creating a new one-time link.
    const url = await createOnboardingLink(store.stripe_account_id);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Stripe onboarding refresh:", error instanceof Error ? error.message : error);
    return fail();
  }
}