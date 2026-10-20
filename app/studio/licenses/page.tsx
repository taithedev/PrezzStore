import {redirect,notFound} from "next/navigation";
import Link from "next/link";
import {admin,currentUser} from "@/lib/supabase";
import {studioRole} from "@/lib/authority";
import LicenseManager from "@/components/license-manager";
export const dynamic="force-dynamic";
export default async function Licenses({searchParams}:{searchParams:Promise<{product?:string}>}){
 const user=await currentUser();if(!user)redirect("/login?next=/studio/licenses");
 const db=admin();
 const {data:stores}=await db.from("prezzstore_stores").select("id,name").is("deleted_at",null);
 const accessible=[] as {id:string;name:string}[];
 for(const s of stores||[])if(["owner","manager"].includes(await studioRole(user,s.id)||""))accessible.push(s);
 const ids=accessible.map(s=>s.id);
 const {data:products}=ids.length?await db.from("prezzstore_products").select("id,title,store_id").in("store_id",ids).eq("kind","digital").is("removed_at",null).order("created_at",{ascending:false}):{data:[] as {id:string;title:string;store_id:string}[]};
 const all=products||[];const requested=(await searchParams).product;
 const selected=requested?all.find(p=>p.id===requested):all[0];
 if(requested&&!selected)notFound();
 return <main className="shell page-top"><div className="inner-hero compact"><span className="section-tag">STUDIO TOOLS</span><h1>Software licenses.</h1><p>Secure one-time key delivery after payment confirmation.</p></div>
 <Link href="/dashboard">Back to studio</Link>
 {all.length?<><div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:18}}>{all.map(p=><Link key={p.id} className="button button-outline" href={"/studio/licenses?product="+p.id}>{p.title}{p.id===selected?.id?" ✓":""}</Link>)}</div>{selected&&<LicenseManager key={selected.id} productId={selected.id}/>}</>:<p>No digital products are available to manage. Create a digital listing first.</p>}
 </main>;
}