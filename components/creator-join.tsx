"use client";
import {useState} from "react";
import Link from "next/link";
import {CheckCircle2,PlusCircle} from "lucide-react";
export default function CreatorJoin({enrolled}:{enrolled:boolean}){
 const [active,setActive]=useState(enrolled),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function join(){setBusy(true);setError("");
  try{const r=await fetch("/api/creator/join",{method:"POST"});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to join");
   setActive(true);window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:"Unable to join");setBusy(false);}
 }
 return <section className="studio-panel creator-join">
  <h2>{active?<CheckCircle2 size={20}/>:<PlusCircle size={20}/>} Creator Program</h2>
  {active?<><p>Your regular Creator account is active. You can list items on your profile and operate studios.</p>
   <Link className="button button-outline" href="/dashboard">Open Creator Studio</Link>
   <p className="tiny-note">PrezzCreator+ is a separate, earned tier based on completed sales.</p>
  </>:<><p>Your account is currently a buyer account. Join the free Creator Program when you want to publish products or open a studio. No payment is needed to join.</p>
   <button className="button button-primary" disabled={busy} type="button" onClick={join}>{busy?"Joining…":"Join Creator Program"}</button>
   <p className="tiny-note">You must confirm your account email. Payments and seller payouts require additional verification when enabled later.</p>
   {error&&<p className="form-error" role="alert">{error}</p>}
  </>}
 </section>;
}
