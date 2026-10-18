import { NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { recipientStatus, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const enabled = stripeConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!enabled) return NextResponse.json({ configured: false, status: "not_configured" }, { headers: { "Cache-Control": "no-store" } });
  try {
    const { data: store, error } = await admin().from("prezzstore_stores")
      .select("stripe_account_id").eq("owner_id", user.id).maybeSingle();
    if (error) throw error;
    if (!store?.stripe_account_id) return NextResponse.json({ configured: true, status: "not_connected" });
    const status = await recipientStatus(store.stripe_account_id);
    return NextResponse.json({ configured: true, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stripe status:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to verify Stripe status." }, { status: 502 });
  }
}