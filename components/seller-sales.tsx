"use client";
import {ShoppingBag, TrendingUp, ReceiptText} from "lucide-react";
export type SellerSale = {
 id:string;title:string;amount_cents:number;
 status:"pending"|"paid"|"failed"|"refunded";created_at:string;
};
export default function SellerSales({orders}:{orders:SellerSale[]}){
 const paid=orders.filter(o=>o.status==="paid");
 const amount=paid.reduce((n,o)=>n+o.amount_cents,0);
 return <><div className="studio-panel-heading"><div><h2>Sales overview</h2><p>Orders are verified server-side from Stripe webhooks.</p></div></div>
 <div className="seller-metrics">
  <div><ShoppingBag size={19}/><small>Total orders</small><strong>{orders.length}</strong></div>
  <div><TrendingUp size={19}/><small>Paid sales</small><strong>{paid.length}</strong></div>
  <div><ReceiptText size={19}/><small>Gross order value</small><strong>{"$"+(amount/100).toFixed(2)}</strong></div>
 </div>
 <div className="studio-panel"><h3>Recent orders</h3>
  {orders.length?<div className="dashboard-products">{orders.map(o=><div className="dashboard-product" key={o.id}>
   <div className="dashboard-thumb"><ReceiptText size={19}/></div><div><strong>{o.title}</strong><small>{new Date(o.created_at).toLocaleDateString()} · {o.status}</small></div>
   <span>{"$"+(o.amount_cents/100).toFixed(2)}</span>
  </div>)}</div>:<p className="muted-text">No orders yet. New purchases will appear here after checkout.</p>}
 </div>
 </>;
}
