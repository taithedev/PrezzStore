"use client";
import {useState} from "react";
import {ArrowUpRight,ShoppingBag} from "lucide-react";
export default function CheckoutButton({productId,kind,price,owner}:{productId:string;kind:string;price:number;owner:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 async function checkout(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setError("");
  const data=new FormData(event.currentTarget);
  try{
   const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    productId,ownerFree:data.get("ownerFree")==="on",discountCode:data.get("discountCode")||""
   })});
   if(response.status===401){window.location.assign("/login?next="+encodeURIComponent("/products/"+productId));return;}
   const result=await response.json();
   if(!response.ok||!result.url)throw new Error(result.error||"Checkout could not start.");
   window.location.assign(result.url);
  }catch(e){setError(e instanceof Error?e.message:"Checkout could not start. Please retry.");setBusy(false);}
 }
 return <form onSubmit={checkout}>
  {owner&&kind!=="membership"&&<label className="checkout-discount"><input type="checkbox" name="ownerFree" value="on"/> Owner perk: obtain item free (optional)</label>}
  {price>0&&<label className="checkout-discount">Discount code (optional)<input name="discountCode" maxLength={32} placeholder="YOURCODE" autoComplete="off"/></label>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  <button disabled={busy} className="button button-primary buy-button"><ShoppingBag size={18}/>{busy?"Opening checkout…":price===0?"Get for free":kind==="membership"?"Join membership":"Buy now"}<ArrowUpRight size={18}/></button>
 </form>;
}
