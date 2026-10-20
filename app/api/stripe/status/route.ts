import {isPlatformStore} from "@/lib/official-store";
import {apiRoute} from "@/lib/api-route";
import { NextRequest,NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { recipientStatus, platformPaymentStatus, stripeConnectConfigured } from "@/lib/stripe";
export const runtime = "nodejs";
async function handleGET(request:NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const enabled = stripeConnectConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!enabled) return NextResponse.json({ configured: false, status: "not_configured" }, { headers: { "Cache-Control": "no-store" } });
  try {
    const selected=new URL(request.url).searchParams.get("store_id")||"";
    if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))return NextResponse.json({error:"Invalid store ID"},{status:400});
    let query=admin().from("prezzstore_stores").select("id,slug,owner_id,is_profile_store,stripe_account_id").eq("owner_id",user.id).is("deleted_at",null);
    if(selected)query=query.eq("id",selected);
    else query=query.eq("is_profile_store",false).order("created_at",{ascending:true}).limit(1);
    const {data:store,error}=await query.maybeSingle();
    if (error) throw error;
    if(store&&await isPlatformStore(store))return NextResponse.json({configured:true,status:await platformPaymentStatus(),source:"platform"},{headers:{"Cache-Control":"no-store"}});
    if (!store?.stripe_account_id) return NextResponse.json({ configured: true, status: "not_connected" });
    const status = await recipientStatus(store.stripe_account_id);
    return NextResponse.json({ configured: true, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Stripe status:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Unable to verify Stripe status." }, { status: 502 });
  }
}

export const GET=apiRoute(handleGET);
