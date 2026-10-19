import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
export const runtime="nodejs";
export async function GET(){
 try{
 const {data,error}=await admin().from("prezzstore_announcements")
   .select("id,title,body,category,created_at").eq("published",true)
   .order("created_at",{ascending:false}).limit(10);
 if(error)throw error;
 return NextResponse.json({items:data||[]},{headers:{"Cache-Control":"no-store"}});
 }catch{
 return NextResponse.json({items:[]},{status:503});
 }
}
