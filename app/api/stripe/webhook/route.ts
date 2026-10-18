import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { admin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({error:"Missing webhook signature"},{status:400});
    const event = stripe().webhooks.constructEvent(await req.text(),signature,process.env.STRIPE_WEBHOOK_SECRET);
    const db = admin();
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return NextResponse.json({received:true});
      const orderId = session.metadata?.prezz_order_id;
      if (orderId && session.id) {
        // Match the session Stripe created, never trust an arbitrary order ID alone.
        const {error} = await db.from("prezz_orders").update({
          status:"paid", stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null
        }).eq("id",orderId).eq("stripe_session_id",session.id).eq("status","pending");
        if (error) throw error;
      }
    } else if(event.type === "checkout.session.async_payment_failed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if(s.metadata?.prezz_order_id) await db.from("prezz_orders").update({status:"failed"}).eq("id",s.metadata.prezz_order_id).eq("stripe_session_id",s.id).eq("status","pending");
    } else if(event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
      const s = event.data.object as Stripe.Subscription;
      const status = s.status === "active" || s.status === "trialing" ? "active" : "inactive";
      const {error} = await db.from("prezz_orders").update({membership_status:status}).eq("stripe_subscription_id",s.id);
      if(error) throw error;
    } else if(event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      if(typeof charge.payment_intent === "string") {
        // Use Checkout session lookup instead of guessing an order from charge metadata.
        const sessions = await stripe().checkout.sessions.list({payment_intent:charge.payment_intent,limit:5});
        for(const s of sessions.data) await db.from("prezz_orders").update({status:"refunded",membership_status:"inactive"}).eq("stripe_session_id",s.id).eq("status","paid");
      }
    }
    return NextResponse.json({received:true});
  } catch(e) {
    console.error("Webhook:",e instanceof Error?e.message:e);
    return NextResponse.json({error:"Webhook verification or processing failed"},{status:400});
  }
}