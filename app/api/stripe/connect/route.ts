import { NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { createRecipient, createOnboardingLink, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";

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
      accountId = await createRecipient(user.email, store.name);
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
    console.error("Seller onboarding:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to start Stripe onboarding. Check sandbox and connected-account settings." }, { status: 502 });
  }
}