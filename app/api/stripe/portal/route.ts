import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {siteUrl,stripe} from "@/lib/stripe";
export const runtime="nodejs";
export async function POST(req:NextRequest) {
 try{
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
  const raw=String((await req.formData()).get("orderId")||"");
  if(!/^[0-9a-f-]{36}$/i.test(raw))return NextResponse.json({error:"Invalid order"},{status:400});
  const {data:o}=await admin().from("prezz_orders").select("id,stripe_session_id,stripe_subscription_id").eq("id",raw).eq("buyer_id",user.id).maybeSingle();
  if(!o?.stripe_session_id||!o.stripe_subscription_id)return NextResponse.json({error:"Membership not found"},{status:404});
  const client=stripe();
  const checkout=await client.checkout.sessions.retrieve(o.stripe_session_id);
  if(checkout.metadata?.prezz_buyer_id!==user.id||typeof checkout.customer!=="string")return NextResponse.json({error:"Customer account missing"},{status:403});
  const portal=await client.billingPortal.sessions.create({customer:checkout.customer,return_url:siteUrl()+"/orders"});
  return NextResponse.redirect(portal.url,303);
 }catch(e){console.error("Billing portal:",e instanceof Error?e.message:e);return NextResponse.json({error:"Membership management is unavailable. Configure the Stripe Billing Portal in the Dashboard."},{status:500});}
}