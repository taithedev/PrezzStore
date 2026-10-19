"use client";
import {useState} from "react";
import {AlertTriangle,ArchiveRestore,Trash2} from "lucide-react";
export default function StudioRemoval({storeId,name,archived=false}:{storeId:string;name:string;archived?:boolean}){
 const [confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(action:"delete"|"restore"){
  if(action==="delete"&&confirm!==name)return;
  setBusy(true);setError("");
  try{
   const r=await fetch("/api/studio/stores/"+storeId,{
    method:action==="delete"?"DELETE":"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(action==="delete"?{confirm_name:confirm}:{})
   });
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||"Could not update studio");
   window.location.assign("/account");
  }catch(e){setError(e instanceof Error?e.message:"Request failed");setBusy(false);}
 }
 if(archived)return <div className="studio-removal"><span>This studio is removed from public view.</span>
  <button type="button" className="button button-outline" disabled={busy} onClick={()=>submit("restore")}><ArchiveRestore size={15}/> Restore studio</button>
  {error&&<p className="form-error">{error}</p>}</div>;
 return <section className="studio-removal">
  <h3><AlertTriangle size={17}/> Delete studio</h3>
  <p>This hides the studio and its products from visitors. Completed orders, receipts and uploaded files remain available. You can restore the studio later.</p>
  <label>Type <strong>{name}</strong> to confirm<input value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder={name} autoComplete="off"/></label>
  <button className="button button-danger" disabled={busy||confirm!==name} type="button" onClick={()=>submit("delete")}>
   <Trash2 size={16}/> {busy?"Removing…":"Delete studio"}
  </button>{error&&<p className="form-error">{error}</p>}
 </section>;
}
