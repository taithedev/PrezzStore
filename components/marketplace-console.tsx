"use client";
import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Megaphone, Tag, Wallet, Users, Trash2, ArrowUpRight } from "lucide-react";
type Choice={id:string;label:string};
export default function MarketplaceConsole({role,commission,stores,products}:{role:"owner"|"admin";commission:number;stores:Choice[];products:Choice[]}){
 const [bps,setBps]=useState(String(commission/100));
 const [code,setCode]=useState("");const [percent,setPercent]=useState("15");
 const [uses,setUses]=useState("");const [discountProduct,setDiscountProduct]=useState("");
 const [announcementTitle,setAnnouncementTitle]=useState("");const [announcementBody,setAnnouncementBody]=useState("");
 const [category,setCategory]=useState("news");const [override,setOverride]=useState(false);
 const [managerStore,setManagerStore]=useState(stores.find(s=>s.label.includes("Zuzify"))?.id||stores[0]?.id||"");
 const [managerEmail,setManagerEmail]=useState("");const [adminEmail,setAdminEmail]=useState("");const [verificationEmail,setVerificationEmail]=useState("");
 const [moderateTarget,setModerateTarget]=useState("product"),[moderateId,setModerateId]=useState("");
 const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
 async function submit(action:string,values:Record<string,unknown>){
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/control",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...values})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not save");
   setMessage(data.message||"Saved");
  }catch(e){setMessage(e instanceof Error?e.message:"Request failed");}
  finally{setBusy(false);}
 }
 return <div className="console-layout">
  <section className="studio-panel"><h2><ShieldCheck size={21}/> Marketplace controls</h2><p className="muted-text">Your changes are validated on the server and apply to future activity.</p>
   <div className="console-grid">
    {role==="owner"&&<div className="console-field"><h3><Wallet size={17}/> Marketplace fee</h3><p>Commission taken from qualifying seller sales. Current: {(commission/100).toFixed(2)}%</p>
     <form onSubmit={e=>{e.preventDefault();submit("commission",{bps:Math.round(Number(bps)*100)});}}>
     <label>Commission (%)<input type="number" min="0" max="30" step=".01" value={bps} onChange={e=>setBps(e.target.value)}/></label>
     <button disabled={busy} className="button button-secondary">Save new rate</button></form></div>}
    {role==="owner"&&<div className="console-field"><h3><Tag size={17}/> Discount generator</h3>
     <form onSubmit={e=>{e.preventDefault();submit("discount",{code,percentage:Number(percent),max_uses:uses?Number(uses):null,product_id:discountProduct||null});}}>
      <label>Promo code<input required pattern="[A-Za-z0-9-]{4,32}" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="WELCOME15"/></label>
      <label>Percent off<input type="number" min="1" max="90" step="1" value={percent} onChange={e=>setPercent(e.target.value)}/></label>
      <label>Max uses (blank = unlimited)<input type="number" min="1" step="1" value={uses} onChange={e=>setUses(e.target.value)}/></label>
      <label>Product<select value={discountProduct} onChange={e=>setDiscountProduct(e.target.value)}><option value="">All eligible products</option>{products.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <button disabled={busy} className="button button-secondary">Create code</button></form></div>}
    <div className="console-field"><h3><Megaphone size={17}/> Global announcement</h3>
     <form onSubmit={e=>{e.preventDefault();submit("announcement",{title:announcementTitle,message:announcementBody,category,override});}}>
      <label>Title<input value={announcementTitle} minLength={3} maxLength={100} required onChange={e=>setAnnouncementTitle(e.target.value)}/></label>
      <label>Type<select value={category} onChange={e=>setCategory(e.target.value)}><option value="news">News</option><option value="alert">Alert</option><option value="update">Update log</option></select></label>
      <label>Message<textarea required maxLength={1500} value={announcementBody} onChange={e=>setAnnouncementBody(e.target.value)}/></label>
      <label className="checkbox-row"><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/> Review override for a false-positive filter result</label>
      <button disabled={busy} className="button button-secondary">Publish announcement</button></form></div>
    <div className="console-field"><h3><Trash2 size={17}/> Content moderation</h3><p>Hide violating content, or restore content after reviewing it. Removal is reversible for audit purposes.</p>
     <form onSubmit={e=>{e.preventDefault();submit("moderate",{target:moderateTarget,id:moderateId,hidden:true,reason:"Moderation review"});}}>
      <label>Type<select value={moderateTarget} onChange={e=>{setModerateTarget(e.target.value);setModerateId("");}}><option value="product">Product</option><option value="store">Store</option></select></label>
      <label>Choose item<select value={moderateId} onChange={e=>setModerateId(e.target.value)} required><option value="">Choose...</option>{(moderateTarget==="store"?stores:products).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <button disabled={busy||!moderateId} className="button button-outline">Hide from marketplace</button></form>
     <button disabled={busy||!moderateId} className="button button-ghost" type="button" onClick={()=>submit("moderate",{target:moderateTarget,id:moderateId,hidden:false})}>Restore selected</button></div>
    {role==="owner"&&<div className="console-field"><h3><Users size={17}/> Assign shop staff</h3><p>Managers can edit only the selected shop and its listings, not marketplace settings.</p>
     <form onSubmit={e=>{e.preventDefault();submit("manager",{store_id:managerStore,email:managerEmail});}}>
      <label>Store<select value={managerStore} onChange={e=>setManagerStore(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <label>Manager account email<input type="email" value={managerEmail} required onChange={e=>setManagerEmail(e.target.value)}/></label>
      <button disabled={busy} className="button button-secondary">Grant access</button></form>
     <button type="button" className="button button-ghost" disabled={busy} onClick={()=>submit("manager",{store_id:managerStore,email:managerEmail,remove:true})}>Revoke access</button></div>}
    {role==="owner"&&<div className="console-field"><h3>Verify creators</h3>
    <p>Grant a checkmark to an account you have reviewed. Owners display a wrench instead.</p>
    <form onSubmit={e=>{e.preventDefault();submit("verify_user",{email:verificationEmail,verify:true});}}>
     <label>Registered account email<input type="email" required value={verificationEmail} onChange={e=>setVerificationEmail(e.target.value)}/></label>
     <button type="submit" className="button button-secondary" disabled={busy}>Verify user</button>
    </form>
    <button type="button" className="button button-ghost" disabled={busy||!verificationEmail} onClick={()=>submit("verify_user",{email:verificationEmail,verify:false})}>Remove verification</button>
   </div>}
   {role==="owner"&&<div className="console-field"><h3>Administrator permissions</h3>
     <p>Admins can moderate stores/products and post news. Only owners can change fees or generate discounts.</p>
     <form onSubmit={e=>{e.preventDefault();submit("admin",{email:adminEmail});}}>
       <label>Account email<input type="email" required value={adminEmail} onChange={e=>setAdminEmail(e.target.value)}/></label>
       <button disabled={busy} className="button button-secondary">Add admin</button></form>
       <button type="button" disabled={busy} className="button button-ghost" onClick={()=>submit("admin",{email:adminEmail,remove:true})}>Revoke admin</button>
    </div>}
   </div>
   <p className="console-status" role="status">{message}</p>
   <Link href="/updates" className="text-link">View public announcements <ArrowUpRight size={15}/></Link>
  </section>
 </div>;
}
