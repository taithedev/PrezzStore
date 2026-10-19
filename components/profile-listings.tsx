"use client";
import {useState} from "react";
import {createBrowserClient} from "@supabase/ssr";
import Link from "next/link";
import {FileUp,ImagePlus,Plus,Save,ExternalLink,PackageOpen} from "lucide-react";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import type {Product} from "@/lib/types";
import ListingEditor from "@/components/listing-editor";
import ListingExtras,{emptyExtras,extrasPayload} from "@/components/listing-extras";
export default function ProfileListings({userId,storeId,initialItems}:{
 userId:string;storeId:string;initialItems:Product[];
}){
 const [items,setItems]=useState(initialItems);
 const [title,setTitle]=useState(""),[desc,setDesc]=useState(""),[price,setPrice]=useState("0");
 const [kind,setKind]=useState<"digital"|"service">("digital"),[stock,setStock]=useState("");
 const [cover,setCover]=useState<File|null>(null),[delivery,setDelivery]=useState<File|null>(null);
 const [extras,setExtras]=useState(emptyExtras),[gallery,setGallery]=useState<File[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function upload(bucket:string,file:File){
  if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error("Supabase not configured");
  const client=createBrowserClient(SUPABASE_URL,SUPABASE_KEY);
  const path=userId+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-z0-9._-]/gi,"-").slice(-80);
  const {error:e}=await client.storage.from(bucket).upload(path,file,{contentType:file.type||"application/octet-stream"});
  if(e)throw e;return path;
 }
 async function publish(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{
   const cents=Math.round(Number(price)*100);
   if(!Number.isInteger(cents)||cents<0||cents>50000000)throw new Error("Enter a valid price");
   if(cover&&(!["image/jpeg","image/png","image/webp","image/gif"].includes(cover.type)||cover.size>5242880))
    throw new Error("Cover image must be PNG/JPG/GIF/WebP under 5 MB");
   if(delivery&&delivery.size>52428800)throw new Error("Files must be 50 MB or smaller");
   if(kind==="digital"&&!delivery)throw new Error("Attach a downloadable file");
   if(gallery.length>5||gallery.some(f=>!["image/jpeg","image/png","image/webp","image/gif"].includes(f.type)||f.size>5242880))throw new Error("Use up to five gallery images under 5 MB each");
   const galleryPaths=await Promise.all(gallery.map(f=>upload("prezzstore_assets",f)));
   const imagePath=cover?await upload("prezzstore_assets",cover):null;
   const filePath=delivery?await upload("prezzstore_deliveries",delivery):null;
   const response=await fetch("/api/studio/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    store_id:storeId,title,description:desc,price_cents:cents,
    category:kind==="service"?"Services":"Digital",kind,stock_quantity:stock===""?null:Number(stock),
    image_path:imagePath,file_path:filePath,published:true,gallery_paths:galleryPaths,...extrasPayload(extras)
   })});
   const json=await response.json();
   if(!response.ok)throw new Error(json.error||"Unable to publish");
   setItems(old=>[json.product as Product,...old]);setTitle("");setDesc("");setPrice("0");
   setCover(null);setDelivery(null);setStock("");setExtras(emptyExtras);setGallery([]);
   setNotice("Added to your public profile.");
  }catch(e){setError(e instanceof Error?e.message:"Upload failed");}finally{setBusy(false);}
 }
 return <div className="profile-editor">
  {error&&<p className="form-error" role="alert">{error}</p>}
  {notice&&<p className="form-success" role="status">{notice}</p>}
  <section className="studio-panel"><h2><Plus size={18}/> Add to your profile</h2>
   <p className="muted-text">Personal profiles are for one-time items and services. To sell monthly subscriptions, use a studio.</p>
   <form className="form-stack" onSubmit={publish}>
    <label>Title<input required minLength={3} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Description<textarea maxLength={10000} value={desc} onChange={e=>setDesc(e.target.value)}/></label>
    <div className="form-columns">
     <label>Type<select value={kind} onChange={e=>setKind(e.target.value as "digital"|"service")}>
      <option value="digital">Digital download</option><option value="service">One-time service</option>
     </select></label>
     <label>Price (USD)<input type="number" min="0" max="500000" step=".01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
    </div>
    <label>Quantity limit (blank = unlimited)<input type="number" min="0" max="1000000" step="1" value={stock} onChange={e=>setStock(e.target.value)} placeholder="Unlimited"/></label>
    <div className="form-columns">
     <label className="file-field"><ImagePlus size={17}/> Cover image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setCover(e.target.files?.[0]||null)}/></label>
     <label className="file-field"><FileUp size={17}/> {kind==="digital"?"Digital file (required)":"File (optional)"}<input type="file" onChange={e=>setDelivery(e.target.files?.[0]||null)}/></label>
    </div>
    <ListingExtras value={extras} onChange={setExtras} gallery={gallery} onGallery={setGallery}/>
    <button className="button button-primary" disabled={busy}><Plus size={16}/> {busy?"Uploading…":"Publish to profile"}</button>
   </form>
  </section>
  <section className="studio-panel"><h2><PackageOpen size={18}/> Your profile listings</h2>
   {items.length?<div className="dashboard-products">{items.map(p=><div className="dashboard-product" key={p.id}>
    <div className="dashboard-thumb">{p.image_url?<img src={p.image_url} alt=""/>:"✳"}</div>
    <div><strong>{p.title}</strong><small>{p.published?"Published":"Draft"} · {p.kind}</small></div>
    <span>{p.price_cents===0?"Free":"$"+(p.price_cents/100).toFixed(2)}</span>
    <ListingEditor product={p} onSaved={updated=>setItems(old=>old.map(x=>x.id===updated.id?updated:x))} onDeleted={id=>setItems(old=>old.filter(x=>x.id!==id))}/>
    {p.published&&<Link href={"/products/"+p.id}><ExternalLink size={16}/></Link>}
   </div>)}</div>:<p className="muted-text">No listings yet.</p>}
  </section>
 </div>;
}
