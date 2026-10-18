import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { siteUrl, stripeV2, type Recipient } from "@/lib/stripe";
export const runtime = "nodejs";
type AccountLink = { url: string };
export async function POST(_:NextRequest) {
  try {
    const user = await currentUser();
    if (!user || !user.email) return NextResponse.json({error:"Sign in first"},{status:401});
    const db=admin();
    const {data:store}=await db.from("prezzstore_stores").select("*").eq("owner_id",user.id).maybeSingle();
    if(!store) return NextResponse.json({error:"Create your shop first"},{status:404});
    let id = store.stripe_account_id as string | null;
    if(!id) {
      const account = await stripeV2<Recipient>("accounts","POST",{
        contact_email:user.email,
        display_name:store.name,
        defaults:{responsibilities:{fees_collector:"application",losses_collector:"application"}},
        dashboard:"express", identity:{country:process.env.STRIPE_CONNECT_COUNTRY || "us"},
        configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{requested:true}}}}},
        include:["configuration.recipient","identity","requirements"]
      });
      id=account.id;
      const {error}=await db.from("prezzstore_stores").update({stripe_account_id:id}).eq("id",store.id).eq("owner_id",user.id);
      if(error) throw error;
    }
    const base=siteUrl();
    const link=await stripeV2<AccountLink>("account_links","POST",{
      account:id,
      use_case:{type:"account_onboarding",account_onboarding:{
        refresh_url:base+"/api/stripe/connect/refresh",
        return_url:base+"/dashboard?stripe=returned"
      }}
    });
    return NextResponse.json({url:link.url});
  } catch(e) {
    console.error("Connect:",e instanceof Error?e.message:e);
    return NextResponse.json({error:"Seller onboarding is unavailable. Check your Stripe sandbox and HTTPS site URL."},{status:500});
  }
}