import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {platformRole} from "@/lib/authority";
export const runtime="nodejs";
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
async function handle(req:NextRequest,id:string,action:"delete"|"restore"){
 const user=await currentUser();
 if(!user)return NextResponse.json({error:"Sign in first"},{status:401});
 if(!uuid.test(id))return NextResponse.json({error:"Invalid studio ID"},{status:400});
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return NextResponse.json({error:"Invalid confirmation"},{status:400});}
 const db=admin();
 const {data:studio,error}=await db.from("prezzstore_stores")
 .select("id,name,slug,owner_id,is_profile_store,deleted_at").eq("id",id).maybeSingle();
 if(error||!studio)return NextResponse.json({error:"Studio not found"},{status:404});
 if(studio.is_profile_store)return NextResponse.json({error:"Personal profiles cannot be deleted as studios"},{status:403});
 const role=await platformRole(user);
 if(studio.owner_id!==user.id&&role!=="owner")return NextResponse.json({error:"Only this studio's owner or a marketplace owner can remove it"},{status:403});
 if(action==="delete"){
  if(body.confirm_name!==studio.name)return NextResponse.json({error:"Type the studio name exactly to confirm"},{status:400});
  if(studio.deleted_at)return NextResponse.json({ok:true,message:"Studio is already removed"});
  const {data:changed,error:writeError}=await db.from("prezzstore_stores")
   .update({deleted_at:new Date().toISOString()}).eq("id",id).is("deleted_at",null).select("id");
  if(writeError)return NextResponse.json({error:"Could not remove studio"},{status:502});
  if(changed?.length)await db.from("prezzstore_moderation_log").insert({
   moderator_id:user.id,target_type:"store",target_id:id,action:"owner_archive",note:"Reversible studio removal"
  });
  return NextResponse.json({ok:true,message:"Studio removed from public view. Orders and receipts were preserved."});
 }
 if(!studio.deleted_at)return NextResponse.json({ok:true,message:"Studio is already active"});
 const {error:writeError}=await db.from("prezzstore_stores").update({deleted_at:null})
 .eq("id",id);
 if(writeError)return NextResponse.json({error:"Could not restore studio"},{status:502});
 await db.from("prezzstore_moderation_log").insert({
  moderator_id:user.id,target_type:"store",target_id:id,action:"owner_restore",note:"Restored previously archived studio"
 });
 return NextResponse.json({ok:true,message:"Studio restored."});
}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return handle(request,(await params).id,"delete");
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return handle(request,(await params).id,"restore");
}
