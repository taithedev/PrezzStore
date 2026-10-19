import {notFound} from "next/navigation";
import Link from "next/link";
import {BadgeCheck,Wrench,UserRound,ArrowLeft,Store} from "lucide-react";
import {admin} from "@/lib/supabase";
import {publicUserBadge,validUserId} from "@/lib/profile";
import {addSellerBadges} from "@/lib/catalog";
import MarketGrid from "@/components/market-grid";
import type {Product} from "@/lib/types";
export const dynamic="force-dynamic";
export default async function PublicProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!validUserId(id))notFound();
 const db=admin();
 const [{data:profile},{data:store}]=await Promise.all([
  db.from("prezzstore_user_profiles").select("display_name,bio").eq("user_id",id).maybeSingle(),
  db.from("prezzstore_stores").select("*").eq("owner_id",id)
   .eq("is_profile_store",true).is("deleted_at",null).maybeSingle()
 ]);
 if(!profile||!store)notFound();
 const badge=await publicUserBadge(id);
 const {data:items}=await db.from("prezzstore_products").select("*")
  .eq("store_id",store.id).eq("published",true).is("removed_at",null)
  .neq("kind","membership").order("created_at",{ascending:false}).limit(120);
 const products=await addSellerBadges((items||[]).map(p=>({...p,store})) as Product[]);
 return <main className="shell page-top">
  <Link className="back-link" href="/explore"><ArrowLeft size={16}/> Browse listings</Link>
  <header className="public-profile-head">
   <div className="profile-symbol"><UserRound size={32}/></div>
   <div><span className="section-tag"><Store size={14}/> CREATOR PROFILE</span>
    <h1>{profile.display_name} {badge==="owner"?<Wrench size={21} className="owner-symbol" aria-label="PrezzStore owner"/>
    :badge==="verified"?<BadgeCheck size={21} className="verified-symbol" aria-label="Verified user"/>:null}</h1>
    <p>{profile.bio||"One-time items and downloads."}</p>
   </div>
  </header>
  <MarketGrid items={products} title={"Listings by "+profile.display_name}/>
 </main>;
}
