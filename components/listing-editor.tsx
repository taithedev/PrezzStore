"use client";
import {useState} from "react";
import {Check,Pencil,LoaderCircle,Trash2} from "lucide-react";
import type {Product} from "@/lib/types";
export default function ListingEditor({product,onSaved,onDeleted,canPublish=true}:{product:Product;canPublish?:boolean;onSaved:(product:Product)=>void;onDeleted?:(id:string)=>void}){
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [title,setTitle]=useState(product.title);
 const [description,setDescription]=useState(product.description||"");
 const [price,setPrice]=useState((product.price_cents/100).toFixed(2));
 const [stock,setStock]=useState(product.stock_quantity===null||product.stock_quantity===undefined?"":String(product.stock_quantity));
 const [published,setPublished]=useState(product.published);
 async function save(e:React.FormEvent){
 e.preventDefault();if(busy)return;setBusy(true);setError("");
 const cents=Math.round(Number(price)*100);
 if(!Number.isSafeInteger(cents)||cents<0||cents>50000000||(product.kind==="membership"&&cents===0)){setError("Enter a valid price ($0 allowed for one-time products).");setBusy(false);return;}
 try{
 const res=await fetch("/api/studio/products/"+product.id,{
 method:"PATCH",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({title,description,price_cents:cents,...(canPublish?{published}:{}),stock_quantity:stock===""?null:Number(stock)})
 });
 const body=await res.json();
 if(!res.ok)throw new Error(body.error||"Could not save");
 onSaved(body.product as Product);setOpen(false);
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
   <label>Price (USD)<input type="number" min={product.kind==="membership"?"1":"0"} max="500000" step=".01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
   {product.kind!=="membership"&&<label>Stock (blank = unlimited)<input type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)}/></label>}
   {canPublish?<label className="checkbox-row"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Public listing</label>:<p className="tiny-note">Your edits go back into review before they become public.</p>}
   {error&&<p role="alert" className="form-error">{error}</p>}
   <button className="button button-primary" type="submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Save listing</button>
   {onDeleted&&<button className="button button-danger" type="button" onClick={remove} disabled={busy}><Trash2 size={15}/> Remove listing</button>}
  </form>}
 </div>;
}
