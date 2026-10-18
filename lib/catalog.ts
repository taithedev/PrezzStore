import { configured, server } from "./supabase";
import {demo} from "./demo";
import type {Product,Store} from "./types";
export async function allProducts():Promise<{items:Product[];preview:boolean}>{
 if(!configured)return {items:demo,preview:true};
 const db=await server();
 if(!db)return {items:demo,preview:true};
 const {data,error}=await db.from("prezzstore_products").select("*,store:prezzstore_stores(*)").eq("published",true).order("created_at",{ascending:false}).limit(80);
 if(error){console.error("Catalog query failed:",error.message);return {items:[],preview:false};}
 return {items:(data||[]) as Product[],preview:false};
}
export async function productById(id:string):Promise<Product|null>{
 if(id.startsWith("preview-"))return demo.find(p=>p.id===id)||null;
 const db=await server();if(!db)return null;
 const {data,error}=await db.from("prezzstore_products").select("*,store:prezzstore_stores(*)").eq("id",id).eq("published",true).maybeSingle();
 if(error)console.error("Product lookup failed:",error.message);
 return data as Product|null;
}
export async function storeBySlug(slug:string):Promise<Store|null>{
 const db=await server();if(!db)return null;
 const {data,error}=await db.from("prezzstore_stores").select("*").eq("slug",slug).maybeSingle();
 if(error)console.error("Store lookup failed:",error.message);
 return data as Store|null;
}