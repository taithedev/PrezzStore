import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { siteUrl, stripe, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/orders", request.url), 303);
  if (!stripeConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Membership management is not configured." }, { status: 503 });
  }
  const data = await request.formData();
  const orderId = String(data.get("orderId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  try {
    const { data: order, error } = await admin().from("prezzstore_orders")
      .select("stripe_session_id,stripe_subscription_id")
      .eq("id", orderId).eq("buyer_id", user.id).maybeSingle();
    if (error) throw error;
    if (!order?.stripe_session_id || !order.stripe_subscription_id) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }
    const checkout = await stripe().checkout.sessions.retrieve(order.stripe_session_id);
    if (checkout.metadata?.prezzstore_buyer_id !== user.id || checkout.mode !== "subscription") {
      return NextResponse.json({ error: "Membership ownership verification failed." }, { status: 403 });
    }
    const customer = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
    if (!customer) return NextResponse.json({ error: "Stripe customer not available." }, { status: 409 });
    const portal = await stripe().billingPortal.sessions.create({
      customer,
      return_url: siteUrl() + "/orders"
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error("Billing portal:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to open billing portal. Check that the portal is enabled in Stripe." }, { status: 502 });
  }
}