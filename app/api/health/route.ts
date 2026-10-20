import {NextResponse} from "next/server";
import {server} from "@/lib/supabase";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const db=await server();if(!db)throw new Error("Database unavailable");
  const {error}=await db.from("prezzstore_stores").select("id").limit(1);if(error)throw error;
  return NextResponse.json({status:"ok",release:"2026.10.20"},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
