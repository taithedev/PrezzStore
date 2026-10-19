import { redirect } from "next/navigation";
import { currentUser, server } from "@/lib/supabase";
import { Gift, Coins, ArrowUpRight } from "lucide-react";
import Link from "next/link";
export const dynamic="force-dynamic";
export const metadata={title:"Rewards"};
export default async function Rewards(){
 const user=await currentUser();if(!user)redirect("/login?next=/rewards");
 const db=await server();
 const {data}=db?await db.from("prezzstore_point_events").select("id,points,reason,created_at")
 .eq("user_id",user.id).order("created_at",{ascending:false}).limit(500):{data:[]};
 const points=(data||[]).reduce((sum,e)=>sum+e.points,0);
 return <div className="shell page-top"><div className="inner-hero compact">
 <span className="section-tag"><Gift size={14}/> PREZZSTORE REWARDS</span><h1>Your points.</h1>
 <p>Earn 1 point for each full dollar spent on completed purchases, including creator memberships and services. Refunded purchases reverse points.</p></div>
 <section className="studio-panel"><div className="reward-count"><Coins size={30}/><div><small>Current points</small><strong>{points.toLocaleString()}</strong></div></div>
 <p className="muted-text">Points are a loyalty score only and are not cash or redeemable until a rewards catalog is launched.</p>
 <Link className="button button-outline" href="/explore">Explore products <ArrowUpRight size={16}/></Link></section>
 <section className="studio-panel"><h2>Points history</h2>{(data||[]).length?data?.map(row=><div className="reward-history" key={row.id}>
 <span>{row.reason==="refund"?"Refund adjustment":"Verified purchase"} · {new Date(row.created_at).toLocaleDateString()}</span>
 <strong>{row.points>0?"+":""}{row.points} points</strong></div>):<p>No points yet. Completed eligible purchases appear here after Stripe verification.</p>}</section></div>;
}
