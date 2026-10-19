import { NextRequest, NextResponse } from "next/server";
import { admin, currentUser } from "@/lib/supabase";
import { canManageTeam, platformRole, requireModerator } from "@/lib/authority";
import { moderationReason } from "@/lib/moderation";
import {creatorPlusStatus,collaboratorLimit} from "@/lib/creator-plus";
export const runtime="nodejs";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
const uuid=(x:unknown)=>typeof x==="string"&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
export async function POST(request:NextRequest){
 const user=await currentUser(),role=await requireModerator(user);
 if(!user||!role)return fail("Owner or administrator access required",403);
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return fail("Invalid request");}
 if(!body||typeof body!=="object"||Array.isArray(body))return fail("Invalid request");
 const action=body.action;
 const db=admin();
 try{
  if(action==="commission"){
   if(role!=="owner")return fail("Only owners control marketplace commission",403);
   const bps=body.bps;
   if(!Number.isInteger(bps)||Number(bps)<0||Number(bps)>3000)return fail("Commission must be between 0% and 30%");
   const {error}=await db.from("prezzstore_platform_settings").update({number_value:bps,updated_by:user.id,updated_at:new Date().toISOString()}).eq("name","commission_bps");
   if(error)throw error;return NextResponse.json({ok:true,message:"Marketplace commission updated. Future checkouts use the new fee."});
  }
  if(action==="discount"){
   if(role!=="owner")return fail("Only owners generate discount codes",403);
   const code=String(body.code||"").trim().toUpperCase();
   const percentage=body.percentage;
   const maxUses=body.max_uses===null||body.max_uses===""?null:body.max_uses;
   const productId=body.product_id?String(body.product_id):null;
   if(!/^[A-Z0-9-]{4,32}$/.test(code)||!Number.isInteger(percentage)||Number(percentage)<1||Number(percentage)>90
     ||(maxUses!==null&&(!Number.isInteger(maxUses)||Number(maxUses)<1||Number(maxUses)>1000000))
     ||(productId!==null&&!uuid(productId)))return fail("Check the code, percentage, product ID, and usage limit.");
   const {error}=await db.from("prezzstore_discounts").insert({code,percentage,product_id:productId,max_uses:maxUses,created_by:user.id});
   if(error)return fail(error.code==="23505"?"That discount code already exists":"Could not create code",409);
   return NextResponse.json({ok:true,message:"Discount code created. Buyers can enter it at checkout."});
  }
  if(action==="announcement"){
   const title=String(body.title||"").trim(),message=String(body.message||"").trim();
   const category=String(body.category||"news");
   if(title.length<3||title.length>100||!message||message.length>1500||!["news","alert","update"].includes(category))return fail("Check announcement fields");
   const flagged=moderationReason(title,message);
   if(flagged && body.override!==true)return fail("Review announcement text: "+flagged);
   const {error}=await db.from("prezzstore_announcements").insert({title,body:message,category,created_by:user.id});
   if(error)throw error;
   if(flagged)await db.from("prezzstore_moderation_log").insert({moderator_id:user.id,target_type:"content",action:"approved_false_positive",note:flagged});
   return NextResponse.json({ok:true,message:"Announcement published for visitors."});
  }
  if(action==="moderate"){
   const target=body.target, id=body.id, hidden=body.hidden===true;
   if(!uuid(id)||!["store","product"].includes(String(target)))return fail("Supply a valid target ID");
   if(target==="store"){
    const {data:match}=await db.from("prezzstore_stores").select("slug").eq("id",id).maybeSingle();
    if(match?.slug==="zuzify"&&role!=="owner")return fail("Only an owner can moderate the official Zuzify store",403);
   }
   const table=target==="store"?"prezzstore_stores":"prezzstore_products";
   const changes=target==="store"?{suspended_at:hidden?new Date().toISOString():null}:{removed_at:hidden?new Date().toISOString():null,published:false};
   const {error}=await db.from(table).update(changes).eq("id",id);
   if(error)throw error;
   await db.from("prezzstore_moderation_log").insert({moderator_id:user.id,target_type:target,target_id:id,action:hidden?"remove":"restore",note:String(body.reason||"").slice(0,250)});
   return NextResponse.json({ok:true,message:hidden?"Listing/store removed from public view.":"Store/listing suspension lifted. Republish products separately."});
  }
  if(action==="manager"){
   const storeId=String(body.store_id||""),email=String(body.email||"").trim().toLowerCase();
   if(!uuid(storeId)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Enter a valid store ID and account email");
   if(!await canManageTeam(user,storeId))return fail("Only a shop's owner can manage its staff",403);
   const {data:uid,error:lookupError}=await db.rpc("prezzstore_verified_user_id",{p_email:email});
   if(lookupError)throw lookupError;
   if(!uid)return fail("No verified PrezzStore account with that email",404);
   if(body.remove===true){
    const {error}=await db.from("prezzstore_store_managers").delete().eq("store_id",storeId).eq("user_id",uid);
    if(error)throw error;
   }else{
    const plus=await creatorPlusStatus(storeId);
    const {data:assigned,error}=await db.rpc("prezzstore_assign_collaborator",{
     p_store:storeId,p_user:uid,p_role:"manager",p_limit:collaboratorLimit(plus.qualified)
    });
    if(error)throw error;
    if(!assigned)return fail("Studio has reached its collaborator limit",409);
   }
   return NextResponse.json({ok:true,message:body.remove===true?"Manager access revoked.":"Manager access granted to the verified account."});
  }
  if(action==="creator_plus_grant"){
   if(role!=="owner")return fail("Only owners can grant PrezzCreator+",403);
   const email=String(body.email||"").trim().toLowerCase();
   if(email.length>254||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return fail("Enter a valid account email");
   const {data:uid,error:lookupError}=await db.rpc("prezzstore_verified_user_id",{p_email:email});
   if(lookupError)throw lookupError;
   if(!uid)return fail("No verified account found for that email",404);
   if(body.remove===true){
     const {error}=await db.from("prezzstore_creator_plus_grants").delete().eq("user_id",uid);
     if(error)throw error;
   }else{
     const {error}=await db.from("prezzstore_creator_plus_grants").upsert({user_id:uid,granted_by:user.id,granted_at:new Date().toISOString()},{onConflict:"user_id"});
     if(error)throw error;
   }
   await db.from("prezzstore_moderation_log").insert({moderator_id:user.id,target_type:"content",action:body.remove===true?"revoke_creator_plus":"grant_creator_plus",note:"PrezzCreator+ owner-granted access"});
   return NextResponse.json({ok:true,message:body.remove===true?"Owner grant removed. Earned eligibility still applies.":"PrezzCreator+ granted. The creator's studios receive program perks."});
  }
  if(action==="verify_user"){
   if(role!=="owner")return fail("Only marketplace owners can verify user profiles",403);
   const email=String(body.email||"").trim().toLowerCase(),verify=body.verify===true;
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return fail("Enter a valid registered email");
   const {data:userId,error:lookupError}=await db.rpc("prezzstore_verified_user_id",{p_email:email});
   if(lookupError)throw lookupError;
   if(!userId)return fail("That email must belong to a confirmed PrezzStore account",404);
   const {data:otherRole}=await db.from("prezzstore_platform_roles").select("role").eq("user_id",userId).maybeSingle();
   if(otherRole?.role==="owner"&&!verify)return fail("Owner identity badges are managed by owner roles",403);
   if(verify){
    const {error}=await db.from("prezzstore_user_verifications").upsert({
     user_id:userId,verified:true,verified_at:new Date().toISOString(),verified_by:user.id,note:"Owner verification"
    },{onConflict:"user_id"});
    if(error)throw error;
   }else{
    const {error}=await db.from("prezzstore_user_verifications").delete().eq("user_id",userId);
    if(error)throw error;
   }
   await db.from("prezzstore_moderation_log").insert({
    moderator_id:user.id,target_type:"content",action:verify?"verify_user":"unverify_user",note:"User verification changed"
   });
   return NextResponse.json({ok:true,message:verify?"User verified. Their profile displays a checkmark.":"User verification removed."});
  }
  if(action==="admin"){
   if(role!=="owner")return fail("Only owners appoint administrators",403);
   const email=String(body.email||"").trim().toLowerCase();
   const {data:uid,error}=await db.rpc("prezzstore_verified_user_id",{p_email:email});
   if(error)throw error;
   if(!uid)return fail("No verified user with this email",404);
   const {data:prior}=await db.from("prezzstore_platform_roles").select("role").eq("user_id",uid).maybeSingle();
   if(prior?.role==="owner")return fail("Owner permissions are protected",403);
   if(body.remove===true){
    const {error:e}=await db.from("prezzstore_platform_roles").delete().eq("user_id",uid).eq("role","admin");
    if(e)throw e;
   }else{
    const {error:e}=await db.from("prezzstore_platform_roles").upsert({user_id:uid,role:"admin"});
    if(e)throw e;
   }
   return NextResponse.json({ok:true,message:body.remove===true?"Admin permissions revoked.":"Admin permissions granted."});
  }
  return fail("Unknown action");
 }catch(e){
  console.error("Marketplace control",e instanceof Error?e.message:e);
  return fail("Unable to save change. Check server configuration.",502);
 }
}
