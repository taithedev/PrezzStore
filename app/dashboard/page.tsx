import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import {redirect} from "next/navigation";
import Studio from "@/components/studio";
import {currentUser,server} from "@/lib/supabase";
import type {Product,Store} from "@/lib/types";
export const dynamic="force-dynamic";
export default async function Dashboard(){
 const user=await currentUser();if(!user&&SUPABASE_URL)redirect("/login?next=/dashboard");
 let store:Store|null=null;let products:Product[]=[];
 if(user){const db=await server();if(db){const {data:s}=await db.from("prezz_stores").select("*").eq("owner_id",user.id).maybeSingle();store=s as Store|null;if(s){const {data:p}=await db.from("prezz_products").select("*").eq("store_id",s.id).order("created_at",{ascending:false});products=(p||[]) as Product[];}}}
 return <Studio userId={user?.id||null} userEmail={user?.email||""} initialStore={store} initialProducts={products}/>;
}