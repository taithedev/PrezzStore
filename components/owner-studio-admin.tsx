"use client";
import {useState} from "react";
import {Store,Trash2} from "lucide-react";
import StudioRemoval from "@/components/studio-removal";
export default function OwnerStudioAdmin({studios}:{studios:{id:string;name:string;slug:string;deleted_at:string|null}[]}){
 const [id,setId]=useState(studios.find(s=>!s.deleted_at)?.id||studios[0]?.id||"");
 const chosen=studios.find(s=>s.id===id);
 if(!studios.length)return null;
 return <section className="studio-panel owner-studio-admin">
  <h2><Store size={19}/> Manage studios</h2>
  <p className="muted-text">Marketplace owners can remove inappropriate or abandoned studios. Deleted studios are hidden, not permanently erased; historic orders are preserved.</p>
  <label>Studio<select value={id} onChange={e=>setId(e.target.value)}>{studios.map(s=><option key={s.id} value={s.id}>{s.name} · /shop/{s.slug}{s.deleted_at?" (deleted)":""}</option>)}</select></label>
  {chosen&&(chosen.deleted_at?<StudioRemoval key={id} storeId={chosen.id} name={chosen.name} archived/>:
   <StudioRemoval key={id} storeId={chosen.id} name={chosen.name}/>)}
 </section>;
}
