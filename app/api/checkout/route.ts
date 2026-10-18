import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { feeBps, siteUrl, stripe, transfersActive } from "@/lib/stripe";
import { randomInt } from "crypto";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.redirect(new URL("/login?next=/", req.url), 303);
    const ct = req.headers.get("content-type") || "";
    let productId = "";
    if (ct.includes("application/json")) productId = String((await req.json()).productId || "");
    else productId = String((await req.formData()).get("productId") || "");
    if (!/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({error:"Invalid product"}, {status:400});
    const db = admin();
    const {data:product} = await db.from("prezz_products").select("*").eq("id",productId).eq("published",true).maybeSingle();
    if (!product || product.price_cents < 100 || product.price_cents > 50000000) return NextResponse.json({error:"Product unavailable"}, {status:404});
    const {data:store} = await db.from("prezz_stores").select("*").eq("id",product.store_id).maybeSingle();
    if (!store || !store.stripe_account_id) return NextResponse.json({error:"Seller has not connected Stripe"}, {status:409});
    if (store.owner_id === user.id) return NextResponse.json({error:"You cannot buy your own product"}, {status:400});
    if (!(await transfersActive(store.stripe_account_id))) return NextResponse.json({error:"Seller payouts are not ready yet"}, {status:409});
    const {data:order,error} = await db.from("prezz_orders").insert({
      buyer_id:user.id, seller_id:store.owner_id, product_id:product.id,
      amount_cents:product.price_cents, status:"pending"
    }).select("id").single();
    if (error || !order) throw new Error("Could not create order");
    const feeRate = feeBps();
    const recurring = product.kind === "membership";
    const client = stripe();
    const session = await client.checkout.sessions.create({
      mode: recurring ? "subscription" : "payment",
      customer_email: user.email,
      line_items: [{ price_data: {
        currency:"usd", unit_amount: product.price_cents,
        product_data: { name: product.title, description: (product.description || "").slice(0,350) },
        ...(recurring ? { recurring:{interval:"month" as const} } : {})
      }, quantity:1 }],
      ...(recurring ? { subscription_data: {
        application_fee_percent: feeRate / 100,
        transfer_data:{ destination: store.stripe_account_id },
        metadata:{prezz_order_id:order.id,prezz_product_id:product.id,prezz_buyer_id:user.id}
      }} : { payment_intent_data: {
        application_fee_amount:Math.round(product.price_cents*feeRate/10000),
        transfer_data:{ destination: store.stripe_account_id }
      }}),
      metadata: {prezz_order_id:order.id, prezz_product_id:product.id, prezz_buyer_id:user.id},
      success_url:siteUrl() + "/orders?checkout=success",
      cancel_url:siteUrl() + "/products/" + product.id,
      // Dynamic payment methods are selected by Stripe Checkout.
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    await db.from("prezz_orders").update({stripe_session_id:session.id}).eq("id",order.id);
    return NextResponse.redirect(session.url, 303);
  } catch(e) {
    console.error("Checkout:", e instanceof Error ? e.message : e);
    return NextResponse.json({error:"Checkout could not be started. Check store setup and try again."},{status:500});
  }
}