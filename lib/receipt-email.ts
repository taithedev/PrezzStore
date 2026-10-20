import {admin} from "@/lib/supabase";
import {siteUrl} from "@/lib/stripe";
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));

/** Secure transactional receipts; optional Resend integration, not a Gmail account. */
export async function sendOrderReceipt(orderId:string):Promise<"sent"|"already_sent"|"not_configured"|"not_eligible"|"failed">{
 const key=process.env.RESEND_API_KEY,from=process.env.PREZZSTORE_RECEIPT_FROM;
 if(!key||!from)return "not_configured";
 if(!/^[0-9a-f-]{36}$/i.test(orderId))return "not_eligible";
 const db=admin();
 const {data:order,error}=await db.from("prezzstore_orders")
   .select("id,buyer_id,amount_cents,status,created_at,product_title,product:prezzstore_products(title)")
   .eq("id",orderId).maybeSingle();
 if(error||!order||order.status!=="paid")return "not_eligible";
 const {data:auth,error:authErr}=await db.auth.admin.getUserById(order.buyer_id);
 if(authErr||!auth.user?.email)return "not_eligible";
 // Retry failed or abandoned sends; the provider idempotency key prevents duplicate receipts.
 const {data:claimed,error:claimError}=await db.rpc("prezzstore_claim_receipt",{p_order_id:orderId});
 if(claimError)return "failed";
 if(!claimed)return "already_sent";
 const product=order.product_title||(Array.isArray(order.product)?order.product[0]?.title:(order.product as {title?:string}|null)?.title);
 const safeTitle=escape(product||"Marketplace purchase");
 const price=(order.amount_cents/100).toFixed(2);
 let link="";
 try{link=siteUrl()+"/orders/receipt/"+order.id;}catch{link="";}
 const safeLink=escape(link);
 const label=order.amount_cents===0?"Free":"$"+price;
 const html=`<div style="font-family:Arial,sans-serif;color:#222;line-height:1.7;max-width:580px;margin:auto">
 <h1 style="font-size:26px">PrezzStore receipt</h1>
 <p>Your order is recorded as complete.</p>
 <p><strong>Item:</strong> ${safeTitle}<br><strong>Amount paid:</strong> ${label}<br>
 <strong>Order reference:</strong> ${escape(order.id)}</p>
 <p><a href="${safeLink}">View and print your receipt</a></p>
 <p>For downloads, open your PrezzStore purchases page. This message is a transaction record, not a charitable receipt.</p></div>`;
 try{
  const result=await fetch("https://api.resend.com/emails",{
   method:"POST",signal:AbortSignal.timeout(10000),headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"prezzstore-order-receipt-"+order.id},
   body:JSON.stringify({from,to:auth.user.email,subject:"Your PrezzStore receipt — "+(product||"Purchase").slice(0,60),
     html,text:`PrezzStore receipt\nItem: ${product||"Marketplace purchase"}\nAmount: ${label}\nOrder: ${order.id}\n${link}`})
  });
  if(!result.ok){
   console.error("Receipt provider returned",result.status);
   await db.from("prezzstore_order_receipt_emails").update({status:"failed",updated_at:new Date().toISOString()}).eq("order_id",orderId);
   return "failed";
  }
  await db.from("prezzstore_order_receipt_emails").update({status:"sent",sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("order_id",orderId);
  return "sent";
 }catch(err){
  console.error("Receipt provider unavailable",err instanceof Error?err.message:err);
  await db.from("prezzstore_order_receipt_emails").update({status:"failed",updated_at:new Date().toISOString()}).eq("order_id",orderId);
  return "failed";
 }
}
