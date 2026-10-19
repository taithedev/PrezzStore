import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { siteUrl, stripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

/** Accept only ordinary USD amounts ($1.00–$500.00), never floating-point monetary math. */
function parseAmountCents(input: FormDataEntryValue | null): number | null {
  if (typeof input !== "string" || !/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?$/.test(input.trim())) return null;
  const [dollars, fraction = ""] = input.trim().split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isInteger(cents) && cents >= 100 && cents <= 50000 ? cents : null;
}

function redirect(request: NextRequest, reason: "amount" | "setup" | "unavailable") {
  return NextResponse.redirect(new URL("/donate?error=" + reason, request.url), 303);
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/x-www-form-urlencoded") && !contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Only donation forms are accepted." }, { status: 415 });
  }
  let body: FormData;
  try { body = await request.formData(); }
  catch { return redirect(request, "amount"); }
  const amountCents = parseAmountCents(body.get("amount"));
  if (!amountCents) return redirect(request, "amount");
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return redirect(request, "setup");
  }

  try {
    const db = admin();
    const { data: donation, error: insertError } = await db.from("prezzstore_donations")
      .insert({ amount_cents: amountCents, status: "pending" }).select("id").single();
    if (insertError || !donation) throw insertError || new Error("Could not create donation");

    const checkout = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "Support PrezzStore",
            description: "Voluntary contribution to the PrezzStore platform; not a charitable donation."
          }
        },
        quantity: 1
      }],
      payment_intent_data: {
        metadata: { prezzstore_payment_type: "donation", prezzstore_donation_id: donation.id }
      },
      metadata: { prezzstore_payment_type: "donation", prezzstore_donation_id: donation.id },
      success_url: siteUrl() + "/donate?thanks=1",
      cancel_url: siteUrl() + "/donate?canceled=1"
    }, { idempotencyKey: "prezzstore_donation_" + donation.id });

    if (!checkout.url) throw new Error("Donation checkout was not created");
    const { data: saved, error: updateError } = await db.from("prezzstore_donations")
      .update({ stripe_session_id: checkout.id })
      .eq("id", donation.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError || !saved) throw updateError || new Error("Donation session was not saved");
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    console.error("PrezzStore donation checkout:", error instanceof Error ? error.message : error);
    return redirect(request, "unavailable");
  }
}
