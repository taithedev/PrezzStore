import {configured,server} from "./supabase";
import {demo} from "./demo";
import {publicUserBadges} from "./profile";
import type {Product,Store} from "./types";
export async function addSellerBadges(items:Product[]):Promise<Product[]>{
 if(!items.length)return items;
 const badges=await publicUserBadges(items.map(x=>x.store?.owner_id||""));
 return items.map(item=>({...item,seller_badge:badges.get(item.store?.owner_id||"")||null}));
}
export async function allProducts():Promise<{items:Product[];preview:boolean}>{
 if(!configured)return {items:demo,preview:true};
 const db=await server();
 if(!db)return {items:demo,preview:true};
 const {data,error}=await db.from("prezzstore_products").select("*,store:prezzstore_stores(*)")
  .eq("published",true).is("removed_at",null).order("created_at",{ascending:false}).limit(80);
 if(error){console.error("Catalog query failed:",error.message);return {items:[],preview:false};}
 const available=(data||[]).filter(p=>!p.store?.suspended_at&&!p.store?.deleted_at
   &&!(p.store?.is_profile_store&&p.kind==="membership")) as Product[];
 return {items:await addSellerBadges(available),preview:false};
}
export async function productById(id:string):Promise<Product|null>{
 if(id.startsWith("preview-"))return demo.find(p=>p.id===id)||null;
 const db=await server();if(!db)return null;
 const {data,error}=await db.from("prezzstore_products").select("*,store:prezzstore_stores(*)")
  .eq("id",id).eq("published",true).is("removed_at",null).maybeSingle();
 if(error)console.error("Product lookup failed:",error.message);
 if(!data||data.store?.suspended_at||data.store?.deleted_at||data.store?.is_profile_store&&data.kind==="membership")return null;
 return (await addSellerBadges([data as Product]))[0]||null;
}
export async function storeBySlug(slug:string):Promise<Store|null>{
 const db=await server();if(!db)return null;
 const {data,error}=await db.from("prezzstore_stores").select("*").eq("slug",slug).maybeSingle();
 if(error)console.error("Store lookup failed:",error.message);
 return data&&!data.suspended_at&&!data.deleted_at&&!data.is_profile_store?data as Store:null;
}
export async function allStores():Promise<Store[]>{
 const db=await server();if(!db)return [];
 const {data,error}=await db.from("prezzstore_stores").select("*")
  .eq("is_profile_store",false).is("deleted_at",null).is("suspended_at",null)
  .order("created_at",{ascending:false}).limit(200);
 if(error){console.error("Store directory query:",error.message);return [];}
 return (data||[]) as Store[];
}
