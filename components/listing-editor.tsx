"use client";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import {useState} from "react";
import {createBrowserClient} from "@supabase/ssr";
import {Check,Pencil,LoaderCircle,Trash2} from "lucide-react";
import type {Product} from "@/lib/types";
import ListingExtras,{extrasPayload} from "@/components/listing-extras";
export default function ListingEditor({product,onSaved,onDeleted,canPublish=true}:{product:Product;canPublish?:boolean;onSaved:(product:Product)=>void;onDeleted?:(id:string)=>void}){
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [title,setTitle]=useState(product.title);
 const [description,setDescription]=useState(product.description||"");
 const [price,setPrice]=useState((product.price_cents/100).toFixed(2));
 const [stock,setStock]=useState(product.stock_quantity===null||product.stock_quantity===undefined?"":String(product.stock_quantity));
 const [published,setPublished]=useState(product.published);
 const [cover,setCover]=useState<File|null>(null),[delivery,setDelivery]=useState<File|null>(null),[gallery,setGallery]=useState<File[]>([]);
 const [removeCover,setRemoveCover]=useState(false),[removeGallery,setRemoveGallery]=useState(false);
 const [category,setCategory]=useState(product.category);
 async function upload(bucket:"prezzstore_assets"|"prezzstore_deliveries",file:File){
  const db=createBrowserClient(SUPABASE_URL,SUPABASE_KEY);
  const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("Sign in again before uploading.");
  const image=bucket==="prezzstore_assets";
  if(file.size>(image?5242880:52428800))throw new Error(image?"Images must be under 5 MB.":"Files must be under 50 MB.");
  if(image&&!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type))throw new Error("Use JPG, PNG, WebP or GIF images.");
  const path=user.id+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-z0-9._-]/gi,"-").slice(-80);
  const {error}=await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||"application/octet-stream"});
  if(error)throw error;return path;
 }
 const [extras,setExtras]=useState({subtitle:product.subtitle||"",tags:(product.tags||[]).join(", "),
  highlights:(product.highlights||[]).join("\n"),fulfillment_note:product.fulfillment_note||""});
 async function save(e:React.FormEvent){
 e.preventDefault();if(busy)return;setBusy(true);setError("");
 const cents=Math.round(Number(price)*100);
 if(!Number.isSafeInteger(cents)||cents<0||cents>50000000||(product.kind==="membership"&&cents===0)){setError("Enter a valid price ($0 allowed for one-time products).");setBusy(false);return;}
 try{
 const media:Record<string,unknown>={};
 if(cover)media.image_path=await upload("prezzstore_assets",cover);else if(removeCover)media.image_path=null;
 if(delivery)media.file_path=await upload("prezzstore_deliveries",delivery);
 if(gallery.length>5)throw new Error("Use up to five gallery images.");
 if(gallery.length)media.gallery_paths=await Promise.all(gallery.map(file=>upload("prezzstore_assets",file)));else if(removeGallery)media.gallery_paths=[];
 const res=await fetch("/api/studio/products/"+product.id,{
 method:"PATCH",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({title,description,category,...media,price_cents:cents,...extrasPayload(extras),...(canPublish?{published}:{}),stock_quantity:stock===""?null:Number(stock)})
 });
 const body=await res.json();
 if(!res.ok)throw new Error(body.error||"Could not save");
 onSaved(body.product as Product);setCover(null);setDelivery(null);setGallery([]);setRemoveCover(false);setRemoveGallery(false);setOpen(false);
 }catch(e){setError(e instanceof Error?e.message:"Could not save");}finally{setBusy(false);}
 }
 async function remove(){
  if(busy||!window.confirm("Remove this listing from public view? This preserves past purchases."))return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/studio/products/"+product.id,{method:"DELETE"});
   if(!r.ok)throw new Error((await r.json()).error||"Could not remove listing");
   onDeleted?.(product.id);
  }catch(e){setError(e instanceof Error?e.message:"Removal failed");}finally{setBusy(false);}
 }
 return <div className="listing-editor">
  <button type="button" className="button button-outline listing-edit-button" onClick={()=>setOpen(x=>!x)}>
   <Pencil size={15}/>{open?"Close":"Edit"}</button>
  {open&&<form className="listing-editor-form form-stack" onSubmit={save}>
   <label>Title<input minLength={3} maxLength={120} required value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label>Description<textarea maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
   <label>Price (USD)<input type="number" min={product.kind==="membership"?"0.50":"0"} max="500000" step=".01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
   {product.kind!=="membership"&&<label>Stock (blank = unlimited)<input type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)}/></label>}
   {product.kind!=="membership"&&<label>Category<input required maxLength={64} value={category} onChange={e=>setCategory(e.target.value)}/></label>}
   <details><summary>Images and delivery file (optional)</summary>
    <label>Replace cover image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setCover(e.target.files?.[0]||null)}/></label>
    {product.image_url&&<label className="checkbox-row"><input type="checkbox" checked={removeCover} onChange={e=>setRemoveCover(e.target.checked)}/> Remove current cover</label>}
    <label>Replace gallery (up to 5 images)<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>setGallery(Array.from(e.target.files||[]))}/></label>
    {!!product.gallery_urls?.length&&<label className="checkbox-row"><input type="checkbox" checked={removeGallery} onChange={e=>setRemoveGallery(e.target.checked)}/> Clear current gallery</label>}
    <label>Replace delivery file<input type="file" onChange={e=>setDelivery(e.target.files?.[0]||null)}/></label>
    <p className="tiny-note">Leave uploads empty to keep current files. Previous purchases keep their original delivery.</p>
   </details>
   <ListingExtras value={extras} onChange={setExtras}/>
   {canPublish?<label className="checkbox-row"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Public listing</label>:<p className="tiny-note">Your edits go back into review before they become public.</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <button className="button button-primary" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Save listing</button>
   {onDeleted&&<button className="button button-danger" type="button" onClick={remove} disabled={busy}><Trash2 size={15}/> Remove listing</button>}
  </form>}
 </div>;
}
