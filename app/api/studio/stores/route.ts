import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {creatorEnrolled} from "@/lib/authority";
import {moderationReason} from "@/lib/moderation";
import {apiRoute} from "@/lib/api-route";
export const POST=apiRoute(async(request:NextRequest)=>{
 const user=await currentUser();
 if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 if(!await creatorEnrolled(user))return NextResponse.json({error:"Join the Creator Program from Account Settings first"},{status:403});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid store details"},{status:400});
 const name=String(body.name||"").trim(),slug=String(body.slug||"").trim().toLowerCase(),description=String(body.description||"").trim();
 if(name.length<2||name.length>70||description.length>1500||!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug))
  return NextResponse.json({error:"Use a name of 2–70 characters and a store link of 3–40 letters, numbers or hyphens."},{status:400});
 if(["zuzify","admin","support","prezzstore"].includes(slug))return NextResponse.json({error:"This store link is reserved."},{status:409});
 if(moderationReason(name,description))return NextResponse.json({error:"Please revise the store name or description."},{status:422});
 const {data:store,error}=await admin().from("prezzstore_stores").insert({owner_id:user.id,name,slug,description}).select("*").single();
 if(error){if(error.code==="23505")return NextResponse.json({error:"That store link is taken. Choose another."},{status:409});throw error;}
 return NextResponse.json({store},{status:201});
});
