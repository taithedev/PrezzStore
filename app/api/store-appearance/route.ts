import {apiRoute} from "@/lib/api-route";
import { NextRequest,NextResponse } from "next/server";
import { currentUser, admin } from "@/lib/supabase";
import { canEditStore,platformRole } from "@/lib/authority";
import { moderationReason } from "@/lib/moderation";
async function handlePATCH(req:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid form"},{status:400});}
 const storeId=String(body.store_id||""),description=String(body.description||"").trim();
 const accent=String(body.accent||"");
 const name=String(body.name||"").trim();
 if(!await canEditStore(user,storeId))return NextResponse.json({error:"Not a manager of this store"},{status:403});
 if(name.length<2||name.length>70||description.length>1500||!/^#[0-9a-f]{6}$/i.test(accent))return NextResponse.json({error:"Check shop name, description, and color"},{status:400});
 const reason=moderationReason(name,description);
 if(reason && !(body.moderationOverride===true && await platformRole(user)))return NextResponse.json({error:"Text requires review: "+reason},{status:422});
 const db=admin();
 const {data:target}=await db.from("prezzstore_stores").select("deleted_at,is_profile_store").eq("id",storeId).maybeSingle();
 if(!target||target.deleted_at||target.is_profile_store)return NextResponse.json({error:"Studio unavailable"},{status:403});
 const images:Record<string,string|null>={};
 for(const field of ["avatar","banner"] as const){
  const path=body[field+"_path"];
  if(path===undefined)continue;
  if(path===null){images[field+"_url"]=null;continue;}
  if(typeof path!=="string"||!path.startsWith(user.id+"/")||path.includes("..")||!/^[a-zA-Z0-9._/-]+$/.test(path))
   return NextResponse.json({error:"Upload images to your account first"},{status:400});
  images[field+"_url"]=db.storage.from("prezzstore_assets").getPublicUrl(path).data.publicUrl;
 }
 const {data,error}=await db.from("prezzstore_stores").update({name,description,accent,...images}).eq("id",storeId).select("*").single();
 if(error){console.error("Store appearance:",error.code,error.message);return NextResponse.json({error:"Failed to save appearance. Please retry."},{status:502});}
 return NextResponse.json({store:data});
}

export const PATCH=apiRoute(handlePATCH);
