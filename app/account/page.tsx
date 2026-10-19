import Link from "next/link";
import {redirect} from "next/navigation";
import {UserRound,ShieldCheck,ShoppingBag,Palette,Gift,Store,ArrowUpRight,Mail,Wrench,BadgeCheck,Settings2} from "lucide-react";
import {admin,currentUser} from "@/lib/supabase";
import {platformRole,creatorEnrolled} from "@/lib/authority";
import CreatorJoin from "@/components/creator-join";
import {ensureOwnProfile,publicUserBadge} from "@/lib/profile";
import ProfileListings from "@/components/profile-listings";
import StudioRemoval from "@/components/studio-removal";
import type {Product} from "@/lib/types";
export const dynamic="force-dynamic";
export const metadata={title:"My account"};
export default async function Account(){
 const user=await currentUser();
 if(!user)redirect("/login?next=/account");
 const db=admin(),role=await platformRole(user);
 const [creator,badge]=await Promise.all([creatorEnrolled(user),publicUserBadge(user.id)]);
 // Regular buyer accounts must not create seller storefronts merely by opening /account.
 let own:Awaited<ReturnType<typeof ensureOwnProfile>>|null=null;
 let profileError=false;
 if(creator){
  try{own=await ensureOwnProfile(user);}
  catch(error){profileError=true;console.error("PrezzStore creator profile initialization:",error instanceof Error?error.message:error);}
 }
 const profile=own?.profile||null,profileStore=own?.store||null;
 const profileItems=profileStore?(await db.from("prezzstore_products").select("*")
  .eq("store_id",profileStore.id).is("removed_at",null).order("created_at",{ascending:false}).limit(100)).data||[]:[];
 const [{data:owned},{data:staff},{data:points}]=await Promise.all([
  db.from("prezzstore_stores").select("id,name,slug,deleted_at").eq("owner_id",user.id).eq("is_profile_store",false).order("created_at",{ascending:true}),
  db.from("prezzstore_store_managers").select("store_id,role").eq("user_id",user.id),
  db.from("prezzstore_point_events").select("points").eq("user_id",user.id).limit(2000)
 ]);
 const selected=[...(owned||[])];
 if(staff?.length){
  const {data:collabStores}=await db.from("prezzstore_stores").select("id,name,slug,deleted_at").in("id",staff.map(s=>s.store_id)).is("deleted_at",null).eq("is_profile_store",false);
  selected.push(...(collabStores||[]));
 }
 if(role==="owner"){
  const {data:zuzu}=await db.from("prezzstore_stores").select("id,name,slug,deleted_at").eq("slug","zuzify").is("deleted_at",null).maybeSingle();
  if(zuzu)selected.push(zuzu);
 }
 const stores=Array.from(new Map(selected.filter(s=>!s.deleted_at).map(s=>[s.id,s])).values());
 const archived=(owned||[]).filter(s=>Boolean(s.deleted_at));
 const pointsTotal=(points||[]).reduce((sum,row)=>sum+row.points,0);
 return <div className="shell page-top account-screen">
  <div className="account-heading"><div className="account-avatar"><UserRound size={28}/></div>
  <div><span className="section-tag">PREZZSTORE / ACCOUNT</span><h1>My account {badge==="owner"?<Wrench className="owner-symbol" aria-label="Marketplace owner" size={25}/>:badge==="verified"?<BadgeCheck className="verified-symbol" aria-label="Verified creator" size={25}/>:null}</h1><p>Manage your stores and account tools.</p></div></div>
  <div className="account-grid">
   <section className="studio-panel"><h2><Mail size={19}/> Account details</h2>
    <div className="account-detail"><span>Email</span><strong>{user.email}</strong></div>
    <div className="account-detail"><span>Email confirmation</span><strong>{user.email_confirmed_at?"Verified":"Pending"}</strong></div>
    <div className="account-detail"><span>Account role</span><strong>{role==="owner"?"Marketplace owner":role==="admin"?"Marketplace admin":"Member"}</strong></div>
    <div className="account-detail"><span>Member since</span><strong>{new Date(user.created_at).toLocaleDateString("en-US")}</strong></div>
    <p className="tiny-note">Contact support if you need help with account access. You can reset your password using the login page.</p>
    <Link className="button button-outline" href="/login">Account sign-in and recovery <ArrowUpRight size={15}/></Link>
   </section>
   <section className="studio-panel"><h2><Store size={19}/> Your studios</h2>
    {stores.length?stores.map(s=><div key={s.id} className="account-detail">
     <Link href={"/shop/"+s.slug}>{s.name}</Link><Link href={"/dashboard?store="+s.id} className="text-link">Manage <ArrowUpRight size={14}/></Link>
    </div>):<p>You don't manage a store yet.</p>}
    {archived.length>0&&<div className="archived-studios"><h3>Deleted studios</h3>{archived.map(s=><div key={s.id} className="account-detail"><span>{s.name}</span><StudioRemoval storeId={s.id} name={s.name} archived/></div>)}</div>}
    {creator&&<Link className="button button-primary" href="/dashboard">Go to Creator Studio <ArrowUpRight size={15}/></Link>}
   </section>
   <section className="studio-panel"><h2><Gift size={19}/> Rewards</h2>
    <strong className="account-points">{pointsTotal.toLocaleString()} points</strong>
    <p className="muted-text">Rewards points are recorded for eligible completed orders, adjusted for refunds.</p>
    <Link className="text-link" href="/rewards">Points history <ArrowUpRight size={14}/></Link>
   </section>
   <section className="studio-panel"><h2><ShieldCheck size={19}/> Preferences</h2>
    <p className="muted-text">Change your appearance settings, access purchases, and track account updates.</p>
    <div className="account-actions"><Link href="/account/settings"><Settings2 size={17}/> Account settings / Creator Program</Link>
     <Link href="/appearance"><Palette size={17}/> Appearance</Link>
     <Link href="/orders"><ShoppingBag size={17}/> Purchases and receipts</Link>
     {creator&&<Link href="/creator-plus"><Store size={17}/> PrezzCreator+ requirements</Link>}
     {role&&<Link href="/control"><ShieldCheck size={17}/> Marketplace controls</Link>}
    </div>
   </section>
  </div>
  <CreatorJoin enrolled={creator}/>
  {creator&&profileError&&<section className="studio-panel"><h2>Profile listings unavailable</h2><p>Your account and purchases are still accessible. Profile setup could not finish; please try again later.</p></section>}
  {creator&&profile&&profileStore&&<div className="profile-section"><div className="inner-hero compact"><span className="section-tag">YOUR PROFILE</span>
  <h2>Profile listings</h2><p>Publish downloads and one-time services without opening a studio.</p></div>
  <ProfileListings userId={user.id} storeId={profileStore.id}
   initialProfile={{display_name:profile.display_name,bio:profile.bio}}
   initialItems={(profileItems||[]) as Product[]}/>
  </div>}
 </div>;
}
