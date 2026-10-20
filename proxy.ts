import {SUPABASE_URL,SUPABASE_KEY} from "@/lib/public-supabase";
import {NextRequest,NextResponse} from "next/server";
import {createServerClient} from "@supabase/ssr";
export async function proxy(request:NextRequest){
 const url=SUPABASE_URL;const key=SUPABASE_KEY;
 if(!url||!key)return NextResponse.next({request});
 let response=NextResponse.next({request});
 const supabase=createServerClient(url,key,{cookies:{
  getAll(){return request.cookies.getAll();},
  setAll(cookies){cookies.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}
 }});
 await supabase.auth.getClaims();
 return response;
}
export const config={matcher:["/((?!api/stripe/webhook|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};