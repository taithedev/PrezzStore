"use client";
import {useCallback,useEffect,useState} from "react";
import {Users,UserPlus,Shield,PenTool,ClipboardCheck,Trash2} from "lucide-react";
type Person={user_id:string;role:"manager"|"reviewer"|"creator";email:string;created_at:string};
type TeamData={role:"owner"|"manager"|"reviewer"|"creator";canInvite:boolean;members:Person[];limit:number};
const descriptions=[
 {name:"manager",title:"Manager",icon:Shield,description:"Edit shop appearance, manage all products and publish listings."},
 {name:"reviewer",title:"Reviewer",icon:ClipboardCheck,description:"Review submissions, approve publishing, or request changes; cannot edit products."},
 {name:"creator",title:"Creator",icon:PenTool,description:"Submit and edit their own products; requires review before publishing."}
] as const;
export default function StudioTeam({storeId}:{storeId:string}){
 const [state,setState]=useState<TeamData|null>(null),[email,setEmail]=useState("");
 const [role,setRole]=useState<"manager"|"reviewer"|"creator">("creator");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  const response=await fetch("/api/studio/team?store_id="+encodeURIComponent(storeId),{cache:"no-store"});
  if(!response.ok)throw new Error("Team details unavailable");
  setState(await response.json() as TeamData);
 },[storeId]);
 useEffect(()=>{let active=true;(async()=>{try{await refresh();}catch(e){if(active)setError(e instanceof Error?e.message:"Failed to load");}})();return()=>{active=false};},[refresh]);
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setMessage("");
  try{const response=await fetch("/api/studio/team",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({store_id:storeId,email,role})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not add collaborator");
   setEmail("");setMessage(data.message);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Failed to invite");}finally{setBusy(false);}
 }
 async function remove(person:Person){
  if(!window.confirm("Remove "+person.email+" from this studio?"))return;
  setBusy(true);setError("");setMessage("");
  try{const response=await fetch("/api/studio/team",{method:"DELETE",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({store_id:storeId,user_id:person.user_id})});
   if(!response.ok)throw new Error((await response.json()).error||"Could not remove collaborator");
   setMessage("Collaborator removed.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Failed to remove");}finally{setBusy(false);}
 }
 return <section className="studio-panel">
  <h2><Users size={19}/> Studio collaborators</h2>
  <p className="muted-text">Give access to people with confirmed PrezzStore accounts. Each role has separate permissions.</p>
  <div className="team-role-grid">{descriptions.map(item=><div key={item.name}>
   <item.icon size={19}/><strong>{item.title}</strong><p>{item.description}</p></div>)}</div>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {message&&<p className="form-success" role="status">{message}</p>}
  {!state?<p>Loading collaborators…</p>:<>
   <div className="team-capacity"><span>{state.members.length} of {state.limit} seats used</span><small>PrezzCreator+ unlocks 10 seats.</small></div>
   {state.members.length?<div className="team-members">{state.members.map(m=><div className="team-member" key={m.user_id}>
    <div><strong>{m.email}</strong><small>{m.role} · added {new Date(m.created_at).toLocaleDateString()}</small></div>
    {state.canInvite&&<button className="button button-ghost" disabled={busy} type="button" onClick={()=>remove(m)} aria-label={"Remove "+m.email}><Trash2 size={17}/></button>}</div>)}</div>
     :<p className="muted-text">No collaborators assigned yet.</p>}
   {state.canInvite?<form className="form-stack team-invite" onSubmit={add}>
     <h3><UserPlus size={19}/> Add or update a collaborator</h3>
     <label>Existing account email<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="collaborator@example.com"/></label>
     <label>Permission<select value={role} onChange={e=>setRole(e.target.value as typeof role)}>
      {descriptions.map(d=><option key={d.name} value={d.name}>{d.title}</option>)}</select></label>
     <button className="button button-primary" disabled={busy}>{busy?"Saving…":"Save collaborator"}</button>
     <p className="tiny-note">The collaborator must create and confirm their account first. You can change someone's role by entering their email again.</p>
   </form>:<p className="tiny-note">Only the store owner can invite or remove collaborators.</p>}
  </>}
 </section>;
}
