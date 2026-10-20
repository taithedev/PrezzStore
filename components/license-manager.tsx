"use client";
import {useEffect,useState} from "react";
export default function LicenseManager({productId}:{productId:string}){
 const [keys,setKeys]=useState("");const [available,setAvailable]=useState<number|null>(null);
 const [assigned,setAssigned]=useState<number|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function refresh(){
  try{const res=await fetch("/api/studio/licenses?product_id="+encodeURIComponent(productId),{cache:"no-store"});const json=await res.json();if(!res.ok)throw Error(json.error||"Unable to fetch inventory");setAvailable(json.available);setAssigned(json.assigned)}catch(e){setMessage(e instanceof Error?e.message:"Inventory unavailable")}
 }
 useEffect(()=>{void refresh()},[productId]);
 async function save(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage("");
  try{const lines=keys.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const res=await fetch("/api/studio/licenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product_id:productId,keys:lines})});
   const json=await res.json();if(!res.ok)throw Error(json.error||"Unable to save");
   setMessage(json.added+" keys added. Duplicate keys were skipped.");setKeys("");await refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"Unable to save")}finally{setBusy(false)}
 }
 return <div className="studio-panel" style={{padding:24,marginTop:16}}>
  <h2>License-key inventory</h2>
  <p className="muted-text">Add one software license per line. Each key is assigned to one verified paid order and shown only to that buyer. Treat keys as sensitive.</p>
  <p role="status">Available: {available===null?"Checking…":available} · Assigned: {assigned===null?"Checking…":assigned}</p>
  <form onSubmit={save}>
   <label htmlFor="license-list">Unassigned license keys</label>
   <textarea id="license-list" rows={8} value={keys} onChange={e=>setKeys(e.target.value)} placeholder={"XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY"} style={{width:"100%",marginBlock:12,padding:12,background:"#111",color:"white",border:"1px solid #383838",borderRadius:12}}/>
   <button className="button button-primary" disabled={busy||!keys.trim()} type="submit">{busy?"Saving…":"Add license keys"}</button>
  </form>
  {message&&<p role="status">{message}</p>}
 </div>;
}