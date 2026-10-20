import {apiRoute} from "@/lib/api-route";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { sendOrderReceipt } from "@/lib/receipt-email";
import {platformRole} from "@/lib/authority";
import {creatorPlusStatus,creatorPlusFeeBps} from "@/lib/creator-plus";
import { marketplaceFeeBps, recipientStatus, siteUrl, stripe, stripeConfigured } from "@/lib/stripe";
export const runtime = "nodejs";

function failure(message: string, status: number, isForm = false, requestUrl?: string) {
  if(isForm && requestUrl){
    const reason=status===503?"setup":status===409?"seller":"unavailable";
    return NextResponse.redirect(new URL("/checkout/unavailable?reason="+reason,requestUrl),303);
  }
  return NextResponse.json({error:message},{status});
}
async function handlePOST(request:NextRequest){
 const contentType=request.headers.get("content-type")||"";
 const isForm=contentType.includes("application/x-www-form-urlencoded")||contentType.includes("multipart/form-data");
 const reject=(msg:string,status:number)=>failure(msg,status,isForm,request.url);
 const user=await currentUser();
 if(!user)return isForm?NextResponse.redirect(new URL("/login?next=/orders",request.url),303):reject("Sign in to purchase",401);
 if(!user.email||!user.email_confirmed_at)return reject("Confirm your email before purchasing.",403);
 let productId="",couponCode="",ownerFree=false;
 try{
   const body=contentType.includes("application/json")?await request.json():await request.formData();
   productId=body instanceof FormData?String(body.get("productId")??""):String(body.productId??"");
   ownerFree=(body instanceof FormData?body.get("ownerFree"):body.ownerFree)=== "on" || (body instanceof FormData?body.get("ownerFree"):body.ownerFree)===true;
   couponCode=(body instanceof FormData?String(body.get("discountCode")??""):String(body.discountCode??"")).trim().toUpperCase();
 }catch{return reject("Invalid checkout request",400);}
 if(!/^[a-f0-9-]{36}$/i.test(productId)||couponCode.length>32)return reject("Invalid product or coupon",400);
 const db=admin();
 let pendingOrderId:string|null=null,pendingSessionId:string|null=null;
 try{
  const {data:product,error:pe}=await db.from("prezzstore_products")
    .select("id,store_id,title,description,price_cents,kind,published,stock_quantity,removed_at,file_path,asset_owner_id,fulfillment_note")
    .eq("id",productId).eq("published",true).is("removed_at",null).maybeSingle();
  if(pe)throw pe;
  if(!product||!Number.isInteger(product.price_cents)||product.price_cents<0||product.price_cents>50000000)
    return reject("Product is not available",404);
  if(product.stock_quantity!==null && product.stock_quantity<1)return reject("Out of stock",409);
  if(!["digital","membership","service"].includes(product.kind))return reject("Invalid product type",400);
  if(product.kind==="membership"&&product.price_cents===0)return reject("Monthly memberships require a price",400);
  const {data:store,error:se}=await db.from("prezzstore_stores").select("owner_id,name,stripe_account_id,suspended_at,deleted_at,is_profile_store")
    .eq("id",product.store_id).maybeSingle();
  if(se)throw se;
  if(!store||store.suspended_at||store.deleted_at)return reject("This seller is unavailable",409);
  if(store.is_profile_store&&product.kind==="membership")return reject("Subscriptions are only available in studios",400);
  if(store.owner_id===user.id&&!ownerFree)return reject("You cannot purchase your own product",400);
  if(ownerFree && await platformRole(user)!=="owner")return reject("Owner-only checkout option",403);
  if(ownerFree && product.kind==="membership")return reject("Recurring memberships cannot be obtained with owner free checkout",400);
  let finalPrice:number=product.price_cents,discountId:string|null=null;
  if(couponCode){
    if(!/^[A-Z0-9-]{4,32}$/.test(couponCode))return reject("Invalid discount code",400);
    const {data:coupon,error:ce}=await db.from("prezzstore_discounts").select("*").eq("code",couponCode).maybeSingle();
    if(ce)throw ce;
    if(!coupon||!coupon.active||coupon.product_id&&coupon.product_id!==product.id
      ||coupon.expires_at&&new Date(coupon.expires_at)<=new Date()
      ||coupon.max_uses!==null&&coupon.used_count>=coupon.max_uses)
      return reject("This discount code is invalid or has expired",400);
    finalPrice=Math.max(0,product.price_cents-Math.round(product.price_cents*coupon.percentage/100));
    discountId=coupon.id;
  }
  if(ownerFree){finalPrice=0;discountId=null;}
  if(product.kind==="membership"&&finalPrice===0)return reject("A membership must have a recurring price.",400);
  if(finalPrice===0||product.kind==="membership"){
   let priorQuery=db.from("prezzstore_orders").select("id").eq("buyer_id",user.id).eq("product_id",product.id).eq("status","paid").limit(1);
   if(product.kind==="membership")priorQuery=priorQuery.eq("membership_status","active");
   const {data:prior,error:priorError}=await priorQuery.maybeSingle();
   if(priorError)throw priorError;
   if(prior)return isForm?NextResponse.redirect(new URL("/orders",request.url),303):NextResponse.json({url:"/orders"});
  }
  if(finalPrice>0&&finalPrice<50)return reject("Discounted total must be at least $0.50",400);
  if(finalPrice>0){
    if(!stripeConfigured()||!process.env.STRIPE_WEBHOOK_SECRET||!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return reject("Payments are not configured",503);
    if(!store.stripe_account_id || await recipientStatus(store.stripe_account_id)!=="active")
      return reject("Seller Stripe onboarding is incomplete",409);
  }
  const {data:order,error:oe}=await db.from("prezzstore_orders").insert({
   buyer_id:user.id,seller_id:store.owner_id,product_id:product.id,
   amount_cents:finalPrice,status:"pending",discount_id:discountId,owner_comped:ownerFree,
   product_title:product.title,store_name:store.name,product_kind:product.kind,
   delivery_file_path:product.file_path,delivery_asset_owner_id:product.asset_owner_id||store.owner_id,
   fulfillment_note:product.fulfillment_note
  }).select("id").single();
  if(oe||!order)throw oe||new Error("Unable to create order");
  pendingOrderId=order.id;

  // Reserve limited inventory once. Parallel checkouts cannot oversell the available count.
  if(product.kind!=="membership"){
   const {data:reserved,error:re}=await db.rpc("prezzstore_reserve_stock",{p_order_id:order.id});
   if(re)throw re;
   if(!reserved){
    await db.from("prezzstore_orders").update({status:"failed"}).eq("id",order.id);
    return reject("This item just sold out",409);
   }
  }

  if(discountId){
   const {data:claimed,error:claimError}=await db.rpc("prezzstore_claim_order_discount",{p_order_id:order.id});
   if(claimError)throw claimError;
   if(!claimed)throw new Error("Discount usage limit reached");
  }
  // Free listings use the same atomic completion path without Stripe or purchase points.
  if(finalPrice===0){
   const {error:freeError}=await db.rpc("prezzstore_settle_order",{p_order_id:order.id,p_status:"paid"});
   if(freeError)throw freeError;
   await sendOrderReceipt(order.id).catch(()=>console.warn("Free order receipt could not be sent",order.id));
   const url="/orders?checkout=free";
   return isForm?NextResponse.redirect(new URL(url,request.url),303):NextResponse.json({url});
  }

  const recurring=product.kind==="membership";
  const baseBps=await marketplaceFeeBps();
  const qualified=store.is_profile_store?false:(await creatorPlusStatus(product.store_id)).qualified;
  const bps=creatorPlusFeeBps(baseBps,qualified);
  const checkout=await stripe().checkout.sessions.create({
   mode:recurring?"subscription":"payment",
   customer_email:user.email,client_reference_id:order.id,
   integration_identifier:"prezzstore.checkout."+Array.from(randomBytes(8),b=>String.fromCharCode(97+b%26)).join(""),
   line_items:[{price_data:{currency:"usd",unit_amount:finalPrice,
     product_data:{name:product.title,description:(product.description??"").slice(0,350)},
     ...(recurring?{recurring:{interval:"month" as const}}:{})},quantity:1}],
   ...(recurring?{subscription_data:{
     application_fee_percent:bps/100,transfer_data:{destination:store.stripe_account_id!},
     metadata:{prezzstore_order_id:order.id,prezzstore_product_id:product.id,prezzstore_buyer_id:user.id}
   }}:{payment_intent_data:{
     application_fee_amount:Math.round(finalPrice*bps/10000),
     transfer_data:{destination:store.stripe_account_id!},
     metadata:{prezzstore_order_id:order.id,prezzstore_product_id:product.id}
   }}),
   metadata:{prezzstore_order_id:order.id,prezzstore_product_id:product.id,prezzstore_buyer_id:user.id},
   expires_at:Math.floor(Date.now()/1000)+1800,
   success_url:siteUrl()+"/orders?checkout=success&order="+order.id,cancel_url:siteUrl()+"/products/"+product.id+"?checkout=cancelled"
  },{idempotencyKey:"prezzstore_checkout_"+order.id});
  pendingSessionId=checkout.id;
  if(!checkout.url)throw new Error("Stripe did not create checkout");
  const {data:saved,error:ue}=await db.from("prezzstore_orders").update({stripe_session_id:checkout.id})
    .eq("id",order.id).eq("status","pending").select("id").maybeSingle();
  if(ue||!saved)throw ue||new Error("Unable to link checkout");
  return isForm?NextResponse.redirect(checkout.url,303):NextResponse.json({url:checkout.url});
 }catch(error){
  console.error("PrezzStore checkout",error instanceof Error?error.message:error);
  if(pendingOrderId){
   // Never release inventory while a Stripe session may still accept payment.
   let mayRelease=!pendingSessionId;
   if(pendingSessionId){
    try{const expired=await stripe().checkout.sessions.expire(pendingSessionId);mayRelease=expired.status==="expired";}
    catch{console.error("Checkout session needs reconciliation",pendingOrderId,pendingSessionId);}
   }
   if(mayRelease){
    const {error:cleanupError}=await db.rpc("prezzstore_settle_order",{p_order_id:pendingOrderId,p_status:"failed"});
    if(cleanupError)console.error("Checkout cleanup failed",pendingOrderId,cleanupError.code);
   }
  }
  return reject("Checkout is unavailable. Please try again.",502);
 }
}

export const POST=apiRoute(handlePOST);
