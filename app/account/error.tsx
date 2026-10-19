"use client";
import {useEffect} from "react";
import Link from "next/link";
import {RefreshCw,ArrowLeft} from "lucide-react";
export default function AccountError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("Account failed to load:",error.message);},[error]);
 return <main className="shell page-top"><section className="studio-panel" style={{maxWidth:760,margin:"45px auto"}}>
  <h1>Account temporarily unavailable</h1>
  <p className="muted-text">We couldn't load your account information. Your saved data has not been deleted.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
   <button className="button button-primary" type="button" onClick={()=>reset()}><RefreshCw size={16}/> Try again</button>
   <Link className="button button-outline" href="/"><ArrowLeft size={16}/> Marketplace</Link>
  </div>
 </section></main>;
}
