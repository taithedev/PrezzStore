import {NextRequest,NextResponse} from "next/server";
import Stripe from "stripe";
import {admin} from "@/lib/supabase";
import {stripeForConnectAndWebhooks,verifyStripeWebhook} from "@/lib/stripe";
import {sendOrderReceipt} from "@/lib/receipt-email";
export const runtime="nodejs";
const idOf=(value:string|{id:string}|null|undefined)=>typeof value==="string"?value:value?.id||null;

export async function POST(request:NextRequest){
 const signature=request.headers.get("stripe-signature"),secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!signature||!secret)return NextResponse.json({error:"Webhook signature is not configured."},{status:400});
 let event:Stripe.Event;
 try{event=verifyStripeWebhook(await request.text(),signature,secret);}
 catch{return NextResponse.json({error:"Invalid Stripe webhook signature."},{status:400});}
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"Order database is not configured."},{status:503});
 const key=process.env.STRIPE_SECRET_KEY||process.env.PREZZSTORE_STRIPE_SECRET_KEY||"";
 if(event.livemode!==key.includes("_live_"))return NextResponse.json({error:"Payment mode does not match this deployment."},{status:400});
 const db=admin();
 async function syncMembership(subscriptionId:string){
  // Events may arrive out of order. Read Stripe's current state instead of replaying stale status.
  const current=await stripeForConnectAndWebhooks().subscriptions.retrieve(subscriptionId);
  const active=current.status==="active"||current.status==="trialing";
  const {error}=await db.from("prezzstore_orders").update({membership_status:active?"active":"inactive"})
   .eq("stripe_subscription_id",subscriptionId).eq("status","paid");
  if(error)throw error;
 }
 try{
  if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
   const session=event.data.object as Stripe.Checkout.Session;
   if (session.payment_status !== "paid") return NextResponse.json({received:true});
   if(session.currency?.toLowerCase()!=="usd"||typeof session.amount_total!=="number")throw new Error("Invalid amount or currency");
   if(session.metadata?.prezzstore_payment_type==="donation"){
    const donationId=session.metadata.prezzstore_donation_id;
    if(!donationId||session.mode!=="payment")throw new Error("Invalid contribution");
    const {data:prior,error}=await db.from("prezzstore_donations").select("id,status,amount_cents")
     .eq("id",donationId).eq("stripe_session_id",session.id).maybeSingle();
    if(error)throw error;
    if(!prior||prior.amount_cents!==session.amount_total)throw new Error("Unmatched contribution");
    if(prior.status==="pending"){
     const {error:saveError}=await db.from("prezzstore_donations").update({status:"paid",paid_at:new Date().toISOString()})
      .eq("id",prior.id).eq("status","pending");
     if(saveError)throw saveError;
    }else if(!["paid","refunded"].includes(prior.status))throw new Error("Invalid contribution status");
   }else{
    const orderId=session.metadata?.prezzstore_order_id,buyerId=session.metadata?.prezzstore_buyer_id;
    if(!orderId||!buyerId)return NextResponse.json({received:true});
    const subscriptionId=idOf(session.subscription);
    const {error}=await db.rpc("prezzstore_settle_order",{
     p_order_id:orderId,p_status:"paid",p_session_id:session.id,p_buyer_id:buyerId,
     p_amount:session.amount_total,p_subscription_id:subscriptionId,p_payment_intent_id:idOf(session.payment_intent)
    });
    if(error)throw error;
    if(subscriptionId)await syncMembership(subscriptionId);
    if(await sendOrderReceipt(orderId)==="failed")throw new Error("Receipt delivery will be retried");
   }
  }else if(event.type==="checkout.session.async_payment_failed"||event.type==="checkout.session.expired"){
   const session=event.data.object as Stripe.Checkout.Session;
   if(session.metadata?.prezzstore_payment_type==="donation"&&session.metadata.prezzstore_donation_id){
    const {error}=await db.from("prezzstore_donations").update({status:"failed"})
     .eq("id",session.metadata.prezzstore_donation_id).eq("stripe_session_id",session.id).eq("status","pending");
    if(error)throw error;
   }else if(session.metadata?.prezzstore_order_id){
    const {error}=await db.rpc("prezzstore_settle_order",{p_order_id:session.metadata.prezzstore_order_id,p_status:"failed",p_session_id:session.id});
    if(error)throw error;
   }
  }else if(event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
   await syncMembership((event.data.object as Stripe.Subscription).id);
  }else if(event.type==="invoice.paid"||event.type==="invoice.payment_failed"){
   const invoice=event.data.object as Stripe.Invoice;
   const subscriptionId=idOf(invoice.parent?.subscription_details?.subscription);
   if(subscriptionId)await syncMembership(subscriptionId);
  }else if(event.type==="charge.refunded"){
   const charge=event.data.object as Stripe.Charge;
   const paymentIntent=idOf(charge.payment_intent);
   if(paymentIntent&&charge.refunded){
    const sessions=await stripeForConnectAndWebhooks().checkout.sessions.list({payment_intent:paymentIntent,limit:100});
    for(const session of sessions.data){
     if(session.metadata?.prezzstore_payment_type==="donation"){
      const {error}=await db.from("prezzstore_donations").update({status:"refunded"}).eq("stripe_session_id",session.id).eq("status","paid");
      if(error)throw error;
      continue;
     }
     const {data:orders,error}=await db.from("prezzstore_orders").select("id").eq("stripe_session_id",session.id);
     if(error)throw error;
     for(const order of orders||[]){
      // Retrying a refund repeats the transaction safely, including stock and reward reversals.
      const {error:settleError}=await db.rpc("prezzstore_settle_order",{p_order_id:order.id,p_status:"refunded",p_session_id:session.id});
      if(settleError)throw settleError;
     }
    }
   }
  }
  return NextResponse.json({received:true});
 }catch(error){
  console.error("Stripe webhook processing",event.id,event.type,error instanceof Error?error.message:error);
  return NextResponse.json({error:"Event not processed. Stripe should retry."},{status:500});
 }
}
