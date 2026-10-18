"use client";
import {useEffect,useState} from "react";
export type Preferences={theme:"oled"|"soft"|"contrast";effect:"none"|"snow"|"stars";density:"comfortable"|"compact";intensity:number;reduce_motion:boolean};
export const defaults:Preferences={theme:"oled",effect:"none",density:"comfortable",intensity:2,reduce_motion:false};
export const storageKey="prezzstore:appearance:v2";
export function applyAppearance(p:Preferences){
 if(typeof document==="undefined")return;
 const root=document.documentElement;
 root.dataset.prezzTheme=p.theme;root.dataset.prezzDensity=p.density;
 root.dataset.prezzEffect=p.reduce_motion?"none":p.effect;
 root.style.setProperty("--prezz-intensity",String(p.intensity/5));
}
export function storeAppearance(p:Preferences){
 try{localStorage.setItem(storageKey,JSON.stringify(p));}catch{}
 applyAppearance(p);
 window.dispatchEvent(new CustomEvent("prezz:appearance",{detail:p}));
}
export default function AppearanceManager(){
 const [prefs,setPrefs]=useState<Preferences>(defaults);
 useEffect(()=>{
  try{const raw=localStorage.getItem(storageKey);if(raw){const p={...defaults,...JSON.parse(raw)} as Preferences;setPrefs(p);applyAppearance(p);}}
  catch{}
  let cancelled=false;
  fetch("/api/preferences",{cache:"no-store"}).then(async res=>{
    if(!res.ok)return;
    const data=await res.json();
    if(cancelled||!data.authenticated||!data.preferences)return;
    const p={...defaults,...data.preferences} as Preferences;
    setPrefs(p);storeAppearance(p);
  }).catch(()=>{});
  const onChange=(e:Event)=>setPrefs((e as CustomEvent<Preferences>).detail);
  window.addEventListener("prezz:appearance",onChange);
  return()=>{cancelled=true;window.removeEventListener("prezz:appearance",onChange);};
 },[]);
 const count=prefs.intensity*8;
 return <div className="prezz-ambient" data-effect={prefs.reduce_motion?"none":prefs.effect} aria-hidden="true">
  {Array.from({length:count},(_,i)=><i key={i} style={{
    left:((i*43+11)%100)+"%",
    width:(i%4+2)+"px",height:(i%4+2)+"px",
    animationDuration:(11+(i*7)%15)+"s",
    animationDelay:"-"+((i*5)%23)+"s",
    opacity:.22+(i%4)*.14
  }}/>)}
 </div>;
}
