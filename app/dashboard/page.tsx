import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import {redirect} from "next/navigation";
import Studio from "@/components/studio";
import {currentUser,server} from "@/lib/supabase";
import type {Product,Store} from "@/lib/types";
import type {SellerSale} from "@/components/seller-sales";
export const dynamic="force-dynamic";
export default async function Dashboard(){
 const user=await currentUser();if(!user&&SUPABASE_URL)redirect("/login?next=/dashboard");
 let store:Store|null=null;let products:Product[]=[];let sales:SellerSale[]=[];
 if(user){const db=await server();if(db){const {data:s}=await db.from("prezzstore_stores").select("*").eq("owner_id",user.id).maybeSingle();store=s as Store|null;if(s){const {data:p}=await db.from("prezzstore_products").select("*").eq("store_id",s.id).order("created_at",{ascending:false});products=(p||[]) as Product[];const {data:o}=await db.from("prezzstore_orders").select("id,amount_cents,status,created_at,product:prezzstore_products(title)").eq("seller_id",user.id).order("created_at",{ascending:false}).limit(50);sales=(o||[]).map(row=>({id:row.id,amount_cents:row.amount_cents,status:row.status,created_at:row.created_at,title:Array.isArray(row.product)?row.product[0]?.title||"Product":(row.product as {title?:string}|null)?.title||"Product"}));}}}
 return <Studio userId={user?.id||null} userEmail={user?.email||""} initialStore={store} initialProducts={products} initialSales={sales}/>;
}