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
    const selected=new URL(request.url).searchParams.get("store_id")||"";
    if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))return fail();
    let query=admin().from("prezzstore_stores").select("id,stripe_account_id").eq("owner_id",user.id).is("deleted_at",null);
    if(selected)query=query.eq("id",selected);
    else query=query.eq("is_profile_store",false).order("created_at",{ascending:true}).limit(1);
    const {data:store,error}=await query.maybeSingle();
    if (error || !store?.stripe_account_id) return fail();
    siteUrl(); // Validate configured origin before creating a new one-time link.
    const url = await createOnboardingLink(store.stripe_account_id,store.id);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Stripe onboarding refresh:", error instanceof Error ? error.message : error);
    return fail();
  }
}