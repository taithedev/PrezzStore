import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { feeBps, recipientStatus, siteUrl, stripe, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const isForm = !contentType.includes("application/json");
  const user = await currentUser();
  if (!user) {
    return isForm
      ? NextResponse.redirect(new URL("/login?next=/orders", request.url), 303)
      : failure("Please sign in to purchase.", 401);
  }
  if (!user.email) return failure("An email address is required.", 400);
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return failure("Payments are not set up yet. The seller can still publish products.", 503);
  }
  let productId = "";
  try {
    const body = contentType.includes("application/json") ? await request.json() : await request.formData();
    productId = body instanceof FormData ? String(body.get("productId") ?? "") : String(body.productId ?? "");
  } catch {
    return failure("Invalid checkout request.", 400);
  }
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return failure("Invalid product.", 400);
  try {
    const db = admin();
    const { data: product, error: productError } = await db.from("prezzstore_products")
      .select("id,store_id,title,description,price_cents,kind,published")
      .eq("id", productId).eq("published", true).maybeSingle();
    if (productError) throw productError;
    if (!product || !Number.isInteger(product.price_cents) || product.price_cents < 100 || product.price_cents > 50000000) {
      return failure("This product isn't currently for sale.", 404);
    }
    if (product.kind !== "digital" && product.kind !== "membership") return failure("Unsupported product type.", 400);
    const { data: store, error: storeError } = await db.from("prezzstore_stores")
      .select("owner_id,stripe_account_id").eq("id", product.store_id).maybeSingle();
    if (storeError) throw storeError;
    if (!store?.stripe_account_id) return failure("Seller has not completed Stripe setup.", 409);
    if (store.owner_id === user.id) return failure("You can't purchase your own product.", 400);
    if (await recipientStatus(store.stripe_account_id) !== "active") {
      return failure("Seller payments aren't ready yet. Complete Stripe onboarding first.", 409);
    }
    const { data: order, error: orderError } = await db.from("prezzstore_orders").insert({
      buyer_id: user.id,
      seller_id: store.owner_id,
      product_id: product.id,
      amount_cents: product.price_cents,
      status: "pending"
    }).select("id").single();
    if (orderError || !order) throw orderError || new Error("Unable to create a pending order");

    const recurring = product.kind === "membership";
    const bps = feeBps();
    const checkout = await stripe().checkout.sessions.create({
      mode: recurring ? "subscription" : "payment",
      customer_email: user.email,
      client_reference_id: order.id,
      integration_identifier: "prezzstore.checkout." + Array.from(randomBytes(8), b => String.fromCharCode(97 + b % 26)).join(""),
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: product.price_cents,
          product_data: { name: product.title, description: (product.description ?? "").slice(0, 350) },
          ...(recurring ? { recurring: { interval: "month" as const } } : {})
        },
        quantity: 1
      }],
      ...(recurring
        ? { subscription_data: {
            application_fee_percent: bps / 100,
            transfer_data: { destination: store.stripe_account_id },
            metadata: { prezzstore_order_id: order.id, prezzstore_product_id: product.id, prezzstore_buyer_id: user.id }
          } }
        : { payment_intent_data: {
            application_fee_amount: Math.round(product.price_cents * bps / 10000),
            transfer_data: { destination: store.stripe_account_id },
            metadata: { prezzstore_order_id: order.id, prezzstore_product_id: product.id }
          } }),
      metadata: { prezzstore_order_id: order.id, prezzstore_product_id: product.id, prezzstore_buyer_id: user.id },
      success_url: siteUrl() + "/orders?checkout=success",
      cancel_url: siteUrl() + "/products/" + product.id
    }, { idempotencyKey: "prezzstore_checkout_" + order.id });
    if (!checkout.url) throw new Error("Stripe did not create a checkout URL");
    const { data: saved, error: updateError } = await db.from("prezzstore_orders")
      .update({ stripe_session_id: checkout.id })
      .eq("id", order.id).eq("buyer_id", user.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError || !saved) throw updateError || new Error("Unable to link checkout to order");
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    console.error("Checkout:", error instanceof Error ? error.message : error);
    return failure("Checkout is temporarily unavailable. Verify the seller account and Stripe configuration.", 502);
  }
}