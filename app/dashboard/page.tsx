import { SUPABASE_URL } from "@/lib/public-supabase";
import { redirect } from "next/navigation";
import Studio from "@/components/studio";
import { admin,currentUser } from "@/lib/supabase";
import {platformRole,studioRole,creatorEnrolled,type StudioRole} from "@/lib/authority";
import {creatorPlusStatus,type CreatorPlusStatus} from "@/lib/creator-plus";
import type {Product,Store} from "@/lib/types";
import type {SellerSale} from "@/components/seller-sales";
export const dynamic="force-dynamic";
export default async function Dashboard({searchParams}:{searchParams:Promise<{store?:string}>}){
 const user=await currentUser();
 if(!user && SUPABASE_URL)redirect("/login?next=/dashboard");
 let store:Store|null=null, products:Product[]=[], sales:SellerSale[]=[];
 let stores:Store[]=[],role:"owner"|"admin"|null=null;
 let studioAccess:StudioRole|null=null, plus:CreatorPlusStatus|null=null, baseBps=1000;
 if(user){
  if(!await creatorEnrolled(user))redirect("/account");
  const db=admin();
  role=await platformRole(user);
  const {data:owned}=await db.from("prezzstore_stores").select("*")
    .eq("owner_id",user.id).eq("is_profile_store",false).is("deleted_at",null).order("created_at",{ascending:true});
  const {data:staff}=await db.from("prezzstore_store_managers").select("store_id").eq("user_id",user.id);
  const ids=(staff||[]).map(x=>x.store_id);
  let visible:Store[]=(owned||[]) as Store[];
  if(ids.length){
   const {data:delegated}=await db.from("prezzstore_stores").select("*").in("id",ids).eq("is_profile_store",false).is("deleted_at",null);
   visible=visible.concat((delegated||[]) as Store[]);
  }
  if(role==="owner"){
   const {data:zuzify}=await db.from("prezzstore_stores").select("*").eq("slug","zuzify").is("deleted_at",null).maybeSingle();
   if(zuzify)visible.push(zuzify as Store);
  }
  // Never expose the official Zuzify studio dashboard to ordinary owners or collaborators.
  if(role!=="owner"&&role!=="admin")visible=visible.filter(s=>s.slug!=="zuzify");
  if(role==="admin"){
   const {data:zuzify}=await db.from("prezzstore_stores").select("*").eq("slug","zuzify").is("deleted_at",null).maybeSingle();
   if(zuzify)visible.push(zuzify as Store);
  }
  stores=Array.from(new Map(visible.map(x=>[x.id,x])).values());
  const requested=(await searchParams).store;
  store=stores.find(s=>s.id===requested)||stores.find(s=>s.slug==="zuzify"&&(role==="owner"||role==="admin"))||stores[0]||null;
  if(store){
   studioAccess=await studioRole(user,store.id);
   plus=await creatorPlusStatus(store.id);
   const {data:feeSetting}=await db.from("prezzstore_platform_settings").select("number_value").eq("name","commission_bps").maybeSingle();
   baseBps=feeSetting?.number_value??1000;
   let listingQuery=db.from("prezzstore_products").select("*").eq("store_id",store.id).is("removed_at",null)
    .order("created_at",{ascending:false}).limit(200);
   // Creators must not receive another creator's private drafts in the client payload.
   if(studioAccess==="creator")listingQuery=listingQuery.eq("submitted_by",user.id);
   const {data:p}=await listingQuery;
   products=(p||[]) as Product[];
   // Sales data is financially sensitive; do not send it to creators or reviewers.
   if(studioAccess==="owner"||studioAccess==="manager"){
    const {data:orders}=await db.from("prezzstore_orders")
     .select("id,amount_cents,status,created_at,product:prezzstore_products!inner(title,store_id)")
     .eq("product.store_id",store.id).order("created_at",{ascending:false}).limit(50);
    sales=(orders||[]).map(row=>({id:row.id,amount_cents:row.amount_cents,status:row.status,created_at:row.created_at,
     title:Array.isArray(row.product)?row.product[0]?.title||"Product":(row.product as {title?:string}|null)?.title||"Product"}));
   }
  }
 }
 return <Studio userId={user?.id||null} userEmail={user?.email||""} initialStore={store}
  initialStores={stores} platformRole={role} studioAccess={studioAccess} plusStatus={plus} baseBps={baseBps} initialProducts={products} initialSales={sales}/>;
}
