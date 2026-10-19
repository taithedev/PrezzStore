import {notFound} from "next/navigation";
import Link from "next/link";
import {BadgeCheck,Wrench,UserRound,ArrowLeft,Store,Globe} from "lucide-react";
import {admin} from "@/lib/supabase";
import {publicUserBadge,validUserId} from "@/lib/profile";
import {addSellerBadges} from "@/lib/catalog";
import MarketGrid from "@/components/market-grid";
import type {Product,Store as StoreData} from "@/lib/types";
export const dynamic="force-dynamic";
export default async function PublicProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params,db=admin();
 const lookup=db.from("prezzstore_user_profiles").select("user_id,username,display_name,bio,avatar_url,banner_url,website_url");
 const {data:profile}=await (validUserId(id)?lookup.eq("user_id",id):lookup.eq("username",id.toLowerCase())).maybeSingle();
 if(!profile)notFound();
 const userId=profile.user_id;
 const {data:shops}=await db.from("prezzstore_stores").select("*").eq("owner_id",userId)
  .is("deleted_at",null).is("suspended_at",null).order("created_at",{ascending:false});
 const personal=(shops||[]).find(s=>s.is_profile_store) as StoreData|undefined;
 const studios=(shops||[]).filter(s=>!s.is_profile_store) as StoreData[];
 const badge=await publicUserBadge(userId);
 const {data:items}=personal?await db.from("prezzstore_products").select("*")
  .eq("store_id",personal.id).eq("published",true).is("removed_at",null)
  .neq("kind","membership").order("created_at",{ascending:false}).limit(120):{data:[]};
 const products=personal?await addSellerBadges((items||[]).map(p=>({...p,store:personal})) as Product[]):[];
 return <main className="shell page-top">
  <Link className="back-link" href="/explore"><ArrowLeft size={16}/> Browse marketplace</Link>
  <header className="public-profile-head identity-public">
   <div className="public-profile-banner" style={profile.banner_url?{backgroundImage:`linear-gradient(90deg,#08080b99,#08080b55),url("${profile.banner_url}")`}:{}}/>
   <div className="profile-symbol">{profile.avatar_url?<img src={profile.avatar_url} alt={profile.display_name}/>:<UserRound size={32}/>}</div>
   <div><span className="section-tag"><Store size={14}/> PUBLIC PROFILE</span>
    <h1>{profile.display_name} {badge==="owner"?<Wrench size={21} className="owner-symbol" aria-label="PrezzStore owner"/>
    :badge==="verified"?<BadgeCheck size={21} className="verified-symbol" aria-label="Verified user"/>:null}</h1>
    <span className="profile-handle">@{profile.username}</span>
    <p>{profile.bio||"Welcome to my profile."}</p>
    {profile.website_url&&<a className="text-link" href={profile.website_url} target="_blank" rel="noopener noreferrer"><Globe size={15}/> Website</a>}
   </div>
  </header>
  {studios.length>0&&<section className="shop-directory profile-shops"><div className="section-heading"><div><span className="section-tag">STOREFRONTS</span><h2>Shops by {profile.display_name}</h2></div></div>
   <div className="shop-grid">{studios.map(shop=><Link href={"/shop/"+shop.slug} className="shop-card" key={shop.id}>
    <div className="shop-card-cover" style={shop.banner_url?{backgroundImage:`url("${shop.banner_url}")`}:{}}/>
    <div className="shop-card-avatar">{shop.avatar_url?<img src={shop.avatar_url} alt=""/>:<Store size={23}/>}</div>
    <h3>{shop.name}</h3><p>{shop.description||"Visit this shop"}</p><span className="text-link">View shop →</span>
   </Link>)}</div>
  </section>}
  {personal&&<MarketGrid items={products} title={"Listings by "+profile.display_name}/>}
 </main>;
}
