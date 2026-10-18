import { NextRequest, NextResponse } from "next/server";
import { currentUser, server } from "@/lib/supabase";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const defaults={theme:"oled",effect:"none",density:"comfortable",intensity:2,reduce_motion:false};
const themes=["oled","soft","contrast"],effects=["none","snow","stars"],densities=["comfortable","compact"];
export async function GET(){
 const user=await currentUser();if(!user)return NextResponse.json({preferences:defaults,authenticated:false},{headers:{"Cache-Control":"no-store"}});
 const db=await server();if(!db)return NextResponse.json({error:"Database unavailable"},{status:503});
 const {data,error}=await db.from("prezzstore_preferences").select("theme,effect,density,intensity,reduce_motion").eq("user_id",user.id).maybeSingle();
 if(error)return NextResponse.json({error:"Could not load appearance"},{status:502});
 return NextResponse.json({preferences:data||defaults,authenticated:true},{headers:{"Cache-Control":"no-store"}});
}
export async function PUT(request:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in to sync preferences"},{status:401});
 const db=await server();if(!db)return NextResponse.json({error:"Database unavailable"},{status:503});
 let input:Record<string,unknown>;
 try{input=await request.json();}catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
 if(!input || typeof input!=="object" || Array.isArray(input))return NextResponse.json({error:"Invalid preferences"},{status:400});
 const theme=input.theme,effect=input.effect,density=input.density,intensity=input.intensity,reduce_motion=input.reduce_motion;
 if(typeof theme!=="string"||!themes.includes(theme)||typeof effect!=="string"||!effects.includes(effect)
    ||typeof density!=="string"||!densities.includes(density)||(typeof intensity!=="number"||!Number.isInteger(intensity))
    ||Number(intensity)<1||Number(intensity)>5||typeof reduce_motion!=="boolean")
   return NextResponse.json({error:"Invalid appearance options"},{status:400});
 const {data,error}=await db.from("prezzstore_preferences").upsert({
   user_id:user.id,theme,effect,density,intensity,reduce_motion,updated_at:new Date().toISOString()
 },{onConflict:"user_id"}).select("theme,effect,density,intensity,reduce_motion").single();
 if(error){console.error("Appearance sync",error.message);return NextResponse.json({error:"Could not sync appearance"},{status:502});}
 return NextResponse.json({preferences:data},{headers:{"Cache-Control":"no-store"}});
}
