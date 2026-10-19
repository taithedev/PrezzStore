import {CheckCircle2, Circle, Gauge, Medal, Percent, Users} from "lucide-react";
import type {CreatorPlusStatus} from "@/lib/creator-plus";
type Rule={label:string;current:number;required:number;currency?:boolean};
export default function CreatorStatus({status,baseBps}:{status:CreatorPlusStatus; baseBps:number}){
 const rules:Rule[]=[
  {label:"Sales over the past 30 days",current:status.sales_30d_cents,required:5000,currency:true},
  {label:"Completed paid orders",current:status.sales_30d_count,required:3},
  {label:"Different buyers",current:status.unique_buyers_30d,required:2},
  {label:"Published products",current:status.published_listings,required:2},
  {label:"Store age (days)",current:status.store_age_days,required:14}
 ];
 const pct=(n:number)=>Math.min(100,Math.round(n*100));
 return <section className="studio-panel creator-status">
  <span className="creator-plus-kicker"><Medal size={15}/> PREZZCREATOR+</span>
  <h2>{status.qualified?"Your store has PrezzCreator+":"Your progress to PrezzCreator+"}</h2>
  <p className="muted-text">Earn lower platform fees by maintaining qualifying sales and an active store.</p>
  <div className="creator-stats">
   <div><Percent size={18}/><small>Your new checkout fee</small><strong>{((status.qualified?Math.min(baseBps,500):baseBps)/100).toFixed(2)}%</strong></div>
   <div><Users size={18}/><small>Collaborator seats</small><strong>{status.qualified?10:3}</strong></div>
   <div><Gauge size={18}/><small>Rolling 30-day sales</small><strong>{"$"+(status.sales_30d_cents/100).toFixed(2)}</strong></div>
  </div>
  <div className="creator-progress">{rules.map(rule=>{
   const pass=rule.current>=rule.required,percent=pct(rule.current/rule.required);
   return <div className="creator-progress-row" key={rule.label}>
    <div className="creator-progress-head">{pass?<CheckCircle2 color="#b9a2ff" size={16}/>:<Circle size={16}/>}<span>{rule.label}</span><strong>{rule.currency?"$"+(rule.current/100).toFixed(2):rule.current} / {rule.currency?"$"+(rule.required/100).toFixed(2):rule.required}</strong></div>
    <div className="creator-progress-track"><span style={{width:percent+"%"}}/></div>
   </div>;
  })}</div>
  <p className="muted-text">{status.active_store?"Store status: active":"Store is suspended; tier benefits are unavailable."} Eligibility updates from verified purchases, refunds and the rolling window. Existing subscriptions retain their original fee configuration.</p>
 </section>;
}
