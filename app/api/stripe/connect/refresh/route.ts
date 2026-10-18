import { NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { siteUrl, stripeV2 } from "@/lib/stripe";
export const runtime="nodejs";
export async function GET() {
  try {
    const u=await currentUser();
    if(!u) return NextResponse.redirect(siteUrl()+"/login");
    const {data:s}=await admin().from("prezzstore_stores").select("stripe_account_id").eq("owner_id",u.id).maybeSingle();
    if(!s?.stripe_account_id) return NextResponse.redirect(siteUrl()+"/dashboard");
    const link=await stripeV2<{url:string}>("account_links","POST",{account:s.stripe_account_id,use_case:{type:"account_onboarding",account_onboarding:{refresh_url:siteUrl()+"/api/stripe/connect/refresh",return_url:siteUrl()+"/dashboard?stripe=returned"}}});
    return NextResponse.redirect(link.url);
  } catch {return NextResponse.redirect(siteUrl()+"/dashboard?stripe=error");}
}