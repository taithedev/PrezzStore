import { redirect } from "next/navigation";
import MarketplaceConsole from "@/components/marketplace-console";
import OwnerStudioAdmin from "@/components/owner-studio-admin";
import { admin,currentUser } from "@/lib/supabase";
import { platformRole } from "@/lib/authority";
export const dynamic="force-dynamic";
export const metadata={title:"Marketplace controls"};
export default async function Control(){
 const user=await currentUser();if(!user)redirect("/login?next=/control");
 const role=await platformRole(user);if(!role)redirect("/dashboard");
 const db=admin();
 const [{data:setting},{data:stores},{data:products}]=await Promise.all([
  db.from("prezzstore_platform_settings").select("number_value").eq("name","commission_bps").single(),
  db.from("prezzstore_stores").select("id,name,slug,deleted_at").eq("is_profile_store",false).order("created_at",{ascending:false}).limit(200),
  db.from("prezzstore_products").select("id,title").order("created_at",{ascending:false}).limit(300)
 ]);
 return <div className="shell page-top"><div className="inner-hero compact"><span className="section-tag">
 {role.toUpperCase()} / PREZZSTORE</span><h1>Marketplace controls.</h1>
 <p>Manage creator access, announcements, discounts, listing safety and platform settings.</p></div>
 <MarketplaceConsole role={role} commission={setting?.number_value??1000}
 stores={(stores||[]).map(s=>({id:s.id,label:s.name+" / "+s.slug}))}
 products={(products||[]).map(p=>({id:p.id,label:p.title+" ("+p.id.slice(0,8)+")"}))}/>
 {role==="owner"&&<OwnerStudioAdmin studios={stores||[]}/>}</div>;
}
