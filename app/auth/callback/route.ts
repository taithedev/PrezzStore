import {NextRequest,NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import {safeNext} from "@/lib/safe-next";
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get("code");
 const next=safeNext(req.nextUrl.searchParams.get("next"));
 const failed=()=>NextResponse.redirect(new URL("/login?error=confirmation&next="+encodeURIComponent(next),req.url));
 if(!code||!SUPABASE_URL||!SUPABASE_KEY)return failed();
 const response=NextResponse.redirect(new URL(next,req.url));
 const db=createServerClient(SUPABASE_URL,SUPABASE_KEY,{cookies:{
  getAll:()=>req.cookies.getAll(),
  setAll(items){items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}
 }});
 try{const {error}=await db.auth.exchangeCodeForSession(code);return error?failed():response;}
 catch{return failed();}
}
