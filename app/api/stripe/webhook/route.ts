import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { admin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook signature is not configured." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Order database is not configured." }, { status: 503 });
  }
  const db = admin();
  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return NextResponse.json({ received: true });
      const orderId = session.metadata?.prezzstore_order_id;
      const buyerId = session.metadata?.prezzstore_buyer_id;
      if (!orderId || !buyerId) return NextResponse.json({ received: true });
      const subscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
      const { data: updated, error } = await db.from("prezzstore_orders").update({
        status: "paid",
        membership_status: session.mode === "subscription" ? "active" : "inactive",
        stripe_subscription_id: subscription
      }).eq("id", orderId).eq("buyer_id", buyerId)
        .eq("stripe_session_id", session.id).eq("status", "pending").select("id");
      if (error) throw error;
      // A retry may legitimately find an already-paid order. Unknown sessions retry for reconciliation.
      if (!updated?.length) {
        const { data: existing } = await db.from("prezzstore_orders").select("id,status")
          .eq("id", orderId).eq("buyer_id", buyerId).eq("stripe_session_id", session.id).maybeSingle();
        if (!existing || (existing.status !== "paid" && existing.status !== "refunded")) {
          throw new Error("No matching order for completed Stripe checkout");
        }
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.prezzstore_order_id) {
        const { error } = await db.from("prezzstore_orders").update({ status: "failed" })
          .eq("id", session.metadata.prezzstore_order_id).eq("stripe_session_id", session.id).eq("status", "pending");
        if (error) throw error;
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const active = subscription.status === "active" || subscription.status === "trialing";
      const { error } = await db.from("prezzstore_orders")
        .update({ membership_status: active ? "active" : "inactive" })
        .eq("stripe_subscription_id", subscription.id).eq("status", "paid");
      if (error) throw error;
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const parent = invoice.parent as { subscription_details?: { subscription?: string | null } } | null;
      const subId = parent?.subscription_details?.subscription;
      if (subId) {
        const { error } = await db.from("prezzstore_orders").update({ membership_status: "inactive" })
          .eq("stripe_subscription_id", subId).eq("status", "paid");
        if (error) throw error;
      }
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent = typeof charge.payment_intent === "string"
        ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntent && charge.refunded) {
        const sessions = await stripe().checkout.sessions.list({ payment_intent: paymentIntent, limit: 100 });
        for (const session of sessions.data) {
          const { error } = await db.from("prezzstore_orders")
            .update({ status: "refunded", membership_status: "inactive" })
            .eq("stripe_session_id", session.id).eq("status", "paid");
          if (error) throw error;
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // Returning 5xx asks Stripe to retry rather than silently marking a paid order as unpaid.
    console.error("Stripe webhook processing:", event.type, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Event not processed. Stripe should retry." }, { status: 500 });
  }
}