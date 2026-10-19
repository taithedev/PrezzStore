import { NextRequest,NextResponse } from "next/server";
import { currentUser, admin } from "@/lib/supabase";
import { canManageStore,platformRole } from "@/lib/authority";
import { moderationReason } from "@/lib/moderation";
export async function PATCH(req:NextRequest){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 let body;try{body=await req.json();}catch{return NextResponse.json({error:"Invalid form"},{status:400});}
 const storeId=String(body.store_id||""),description=String(body.description||"").trim();
 const accent=String(body.accent||"");
 const banner_url=body.banner_url===null?null:String(body.banner_url||"");
 if(!await canManageStore(user,storeId))return NextResponse.json({error:"Not a manager of this store"},{status:403});
 if(description.length>1500||!/^#[0-9a-f]{6}$/i.test(accent)||banner_url.length>2048)return NextResponse.json({error:"Invalid store appearance"},{status:400});
 const reason=moderationReason(description);
 if(reason && !(body.moderationOverride===true && await platformRole(user)))return NextResponse.json({error:"Text requires review: "+reason},{status:422});
 const db=admin();
 if(banner_url){
  const {data:store}=await db.from("prezzstore_stores").select("banner_url").eq("id",storeId).maybeSingle();
  if(banner_url!==store?.banner_url && !banner_url.startsWith((process.env.NEXT_PUBLIC_SUPABASE_URL||"")+"/storage/v1/object/public/prezzstore_assets/"+user.id+"/"))
   return NextResponse.json({error:"Upload an authorized image to your storage folder"},{status:400});
 }
 const {data,error}=await db.from("prezzstore_stores").update({description,accent,banner_url}).eq("id",storeId).select("*").single();
 if(error)return NextResponse.json({error:"Failed to save appearance"},{status:502});
 return NextResponse.json({store:data});
}
