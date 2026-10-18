"use client";
import {useState} from "react";
import Link from "next/link";
import {Check,CloudSnow,Layers3,LoaderCircle,ShieldCheck,SlidersHorizontal,Stars} from "lucide-react";
import {applyAppearance,defaults,storeAppearance,type Preferences} from "@/components/appearance-manager";
export default function AppearancePanel({initial,authenticated}:{initial:Preferences;authenticated:boolean}){
 const [settings,setSettings]=useState<Preferences>({...defaults,...initial});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 function change(next:Preferences){setSettings(next);storeAppearance(next);}
 async function save(){
  setBusy(true);setMessage("");setError("");
  try{
   storeAppearance(settings);
   if(authenticated){
    const res=await fetch("/api/preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});
    const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not sync appearance");
    setMessage("Preferences synced securely to your account.");
   }else setMessage("Saved on this device. Sign in to sync across devices.");
  }catch(e){setError(e instanceof Error?e.message:"Could not save");}finally{setBusy(false);}
 }
 return <section className="shell appearance-page page-top">
  <div className="inner-hero compact"><span className="section-tag">PREZZSTORE / YOUR SPACE</span><h1>Appearance studio<span className="hero-period">.</span></h1><p>Customize your whole browsing experience. Preview changes immediately.</p></div>
  <div className="appearance-grid">
   <div className="studio-panel">
    <h2><Layers3 size={20}/> Color themes</h2>
    <div className="theme-options">
     {([{value:"oled",label:"OLED Black",hint:"Pitch black and white"},{value:"soft",label:"Soft Graphite",hint:"Layered charcoal panels"},{value:"contrast",label:"High Contrast",hint:"Sharper borders, clear text"}] as const).map(opt=>
       <button type="button" aria-pressed={settings.theme===opt.value} key={opt.value} onClick={()=>change({...settings,theme:opt.value})} className={"theme-option "+(settings.theme===opt.value?"picked":"")}>
        <span className={"theme-swatch prezz-swatch-"+opt.value}/><strong>{opt.label}</strong><small>{opt.hint}</small>
       </button>)}
    </div>
    <h2><CloudSnow size={20}/> Background effects</h2>
    <div className="effect-options">
     {(["none","snow","stars"] as const).map(effect=><button type="button" key={effect} aria-pressed={settings.effect===effect} className={settings.effect===effect?"picked":""} onClick={()=>change({...settings,effect})}>{effect==="none"?"None":effect==="snow"?"Snowfall":"Stars"}</button>)}
    </div>
    <label className="appearance-slider">Effect density <strong>{settings.intensity}/5</strong><input aria-label="Effect density" type="range" min={1} max={5} value={settings.intensity} onChange={e=>change({...settings,intensity:Number(e.target.value)})}/></label>
   </div>
   <div className="studio-panel">
    <h2><SlidersHorizontal size={20}/> Interface options</h2>
    <div className="effect-options">{(["comfortable","compact"] as const).map(density=><button type="button" key={density} className={settings.density===density?"picked":""} aria-pressed={settings.density===density} onClick={()=>change({...settings,density})}>{density==="comfortable"?"Comfortable spacing":"Compact spacing"}</button>)}</div>
    <label className="checkbox-row appearance-checkbox"><input type="checkbox" checked={settings.reduce_motion} onChange={e=>change({...settings,reduce_motion:e.target.checked})}/> Reduce motion and turn off animated backgrounds</label>
    <div className="appearance-preview"><span>PREZZSTORE / PERSONALIZE</span><strong>Built your way.</strong><small>{settings.theme==="oled"?"True-black OLED":settings.theme==="soft"?"Soft graphite":"High contrast"} · {settings.effect}</small></div>
    {message&&<p className="form-success" role="status">{message}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    <div className="appearance-actions">
     <button className="button button-primary" onClick={save} disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} Save settings</button>
     <button className="button button-outline" onClick={()=>change(defaults)}>Reset</button>
    </div>
    <p className="tiny-note"><ShieldCheck size={14}/> {authenticated?"Settings sync to your Supabase account.":"Guest settings stay on this browser."} <Link href="/dashboard">Back to dashboard</Link></p>
   </div>
  </div>
 </section>;
}
