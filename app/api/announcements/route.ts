import {apiRoute} from "@/lib/api-route";
import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
export const runtime="nodejs";
async function handleGET(){
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

export const GET=apiRoute(handleGET);
