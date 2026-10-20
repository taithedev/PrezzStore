import {NextRequest,NextResponse} from "next/server";
import {admin,currentUser} from "@/lib/supabase";
import {canManageStore,canManageTeam,studioRole} from "@/lib/authority";
import {collaboratorLimit,creatorPlusStatus} from "@/lib/creator-plus";
export const runtime="nodejs";
const isUuid=(s:string)=>/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const fail=(error:string,status=400)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:NextRequest){
 const user=await currentUser();if(!user)return fail("Sign in first",401);
 const storeId=new URL(request.url).searchParams.get("store_id")||"";
 if(!isUuid(storeId))return fail("Invalid store");
 const role=await studioRole(user,storeId);
 if(!role)return fail("No studio access",403);
 const db=admin();
 const {data:store,error:se}=await db.from("prezzstore_stores").select("owner_id").eq("id",storeId).maybeSingle();
 if(se||!store)return fail("Store not found",404);
 const {data:rows,error:re}=await db.from("prezzstore_store_managers")
  .select("user_id,role,created_at").eq("store_id",storeId).order("created_at");
 if(re)return fail("Cannot load collaborators",503);
 // Only the account owner and staff in this studio can see its roster.
 const members=await Promise.all((rows||[]).map(async r=>{
  const {data}=await db.auth.admin.getUserById(r.user_id);
  return {user_id:r.user_id,role:r.role,created_at:r.created_at,email:data.user?.email||"Account unavailable"};
 }));
 const plus=await creatorPlusStatus(storeId);
 return NextResponse.json({role,canInvite:role==="owner",ownerId:store.owner_id,members,limit:collaboratorLimit(plus.qualified)},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:NextRequest){
 const user=await currentUser();if(!user)return fail("Sign in first",401);
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return fail("Invalid request");}
 const storeId=String(body.store_id||""),email=String(body.email||"").trim().toLowerCase(),role=String(body.role||"");
 if(!isUuid(storeId)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail("Invalid studio or email");
 if(!["manager","reviewer","creator"].includes(role))return fail("Choose a collaborator role",400);
 if(!await canManageTeam(user,storeId))return fail("Only the store owner may change collaborators",403);
 const {data:targetStore}=await admin().from("prezzstore_stores").select("slug").eq("id",storeId).maybeSingle();
 if(targetStore?.slug==="zuzify")return fail("Official Zuzify shop access is managed through PrezzStore platform roles",403);
 const db=admin();
 const {data:ownerStore}=await db.from("prezzstore_stores").select("owner_id").eq("id",storeId).maybeSingle();
 if(!ownerStore)return fail("Store not found",404);
 const {data:userId,error:lookupError}=await db.rpc("prezzstore_verified_user_id",{p_email:email});
 if(lookupError)return fail("Account lookup is unavailable",503);
 if(!userId)return fail("That email must belong to a confirmed PrezzStore account",404);
 if(userId===ownerStore.owner_id)return fail("The store owner already has full access");
 // Platform owner permissions cannot be downgraded through a collaborator grant.
 const plus=await creatorPlusStatus(storeId);
 const {data:result,error:assignError}=await db.rpc("prezzstore_assign_collaborator",{
  p_store:storeId,p_user:userId,p_role:role,p_limit:collaboratorLimit(plus.qualified)
 });
 if(assignError)return fail("Unable to save collaborator",503);
 if(!result)return fail("No seats available for your current plan",409);
 return NextResponse.json({ok:true,message:role+" access granted. The user can open this studio now."});
}
export async function DELETE(request:NextRequest){
 const user=await currentUser();if(!user)return fail("Sign in first",401);
 let body:Record<string,unknown>;
 try{body=await request.json();}catch{return fail("Invalid request");}
 const storeId=String(body.store_id||""),target=String(body.user_id||"");
 if(!isUuid(storeId)||!isUuid(target))return fail("Invalid selection");
 if(!await canManageTeam(user,storeId))return fail("Only the store owner may revoke access",403);
 const {error}=await admin().from("prezzstore_store_managers").delete().eq("store_id",storeId).eq("user_id",target);
 if(error)return fail("Unable to remove collaborator",503);
 return NextResponse.json({ok:true});
}
