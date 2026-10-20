import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {ReceiptText,ArrowLeft} from "lucide-react";
import {currentUser,admin} from "@/lib/supabase";
import PrintReceipt from "@/components/print-receipt";
export const dynamic="force-dynamic";
export const metadata={title:"Purchase receipt"};
export default async function Receipt({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect("/login?next=/orders");
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const {data:order}=await admin().from("prezzstore_orders")
  .select("id,amount_cents,status,created_at,stripe_session_id,product:prezzstore_products(title,kind,store:prezzstore_stores(name))")
  .eq("id",id).eq("buyer_id",user.id).maybeSingle();
 if(!order||!["paid","refunded"].includes(order.status))notFound();
 const {data:license}=order.status==="paid"?await admin().from("prezzstore_license_keys").select("license_key").eq("order_id",id).maybeSingle():{data:null};
 const prod=Array.isArray(order.product)?order.product[0]:order.product;
 const shop=prod?.store;
 const store=Array.isArray(shop)?shop[0]?.name:(shop as {name?:string}|null|undefined)?.name;
 return <div className="shell page-top"><Link className="back-link" href="/orders"><ArrowLeft size={16}/> All purchases</Link>
 <section className="receipt-sheet"><span className="section-tag"><ReceiptText size={16}/> PREZZSTORE / ORDER RECEIPT</span>
 <h1>Purchase receipt</h1><div className="receipt-section"><span>Order reference</span><strong>{order.id}</strong></div>
 <div className="receipt-section"><span>Item</span><strong>{prod?.title||"Marketplace purchase"}</strong></div>
 <div className="receipt-section"><span>Seller</span><strong>{store||"PrezzStore seller"}</strong></div>
 <div className="receipt-section"><span>Date</span><strong>{new Date(order.created_at).toLocaleString("en-US")}</strong></div>
 <div className="receipt-section"><span>Status</span><strong>{order.status}</strong></div>
 <div className="receipt-section"><span>Order amount</span><strong>{order.amount_cents===0?"Free":"$"+(order.amount_cents/100).toFixed(2)+" USD"}</strong></div>
 {license?.license_key&&<div className="receipt-section"><span>Software license key</span><strong style={{overflowWrap:"anywhere",userSelect:"text"}}>{license.license_key}</strong></div>}
 <p className="muted-text">This is a marketplace order record. It is not a tax invoice. Card and payment details are managed by Stripe.</p>
 <PrintReceipt/>
 </section></div>;
}
