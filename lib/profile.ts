import {admin} from "@/lib/supabase";
import {platformRole,type SessionUser} from "@/lib/authority";
export type UserBadge="owner"|"verified"|null;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function validUserId(userId:string){return uuid.test(userId);}
export async function publicUserBadge(userId:string):Promise<UserBadge>{
 const db=admin();
 const [{data:role},{data:verified}]=await Promise.all([
   db.from("prezzstore_platform_roles").select("role").eq("user_id",userId).maybeSingle(),
   db.from("prezzstore_user_verifications").select("verified").eq("user_id",userId).eq("verified",true).maybeSingle()
 ]);
 return role?.role==="owner"?"owner":verified?.verified===true?"verified":null;
}
export async function publicUserBadges(userIds:string[]):Promise<Map<string,UserBadge>>{
 const ids=[...new Set(userIds.filter(validUserId))];
 const badges=new Map<string,UserBadge>();
 if(!ids.length)return badges;
 const db=admin();
 const [{data:roles},{data:verified}]=await Promise.all([
  db.from("prezzstore_platform_roles").select("user_id,role").in("user_id",ids).eq("role","owner"),
  db.from("prezzstore_user_verifications").select("user_id").in("user_id",ids).eq("verified",true)
 ]);
 for(const row of verified||[])badges.set(row.user_id,"verified");
 for(const row of roles||[])badges.set(row.user_id,"owner");
 return badges;
}
export async function ensureOwnProfile(user:SessionUser,{createStore=true}:{createStore?:boolean}={}){
 const db=admin();
 let {data:profile,error:profileError}=await db.from("prezzstore_user_profiles")
  .select("user_id,display_name,bio").eq("user_id",user.id).maybeSingle();
 if(profileError)throw profileError;
 if(!profile){
  const nickname=String(user.user_metadata?.display_name||"Creator").trim().slice(0,50);
  const {data:added,error}=await db.from("prezzstore_user_profiles")
    .upsert({user_id:user.id,display_name:nickname.length>=2?nickname:"Creator"},{onConflict:"user_id",ignoreDuplicates:true})
    .select("user_id,display_name,bio").maybeSingle();
  if(error)throw error;
  profile=added;
  if(!profile){
   const retry=await db.from("prezzstore_user_profiles").select("user_id,display_name,bio").eq("user_id",user.id).single();
   if(retry.error)throw retry.error;
   profile=retry.data;
  }
 }
 let {data:store,error:storeError}=await db.from("prezzstore_stores")
  .select("*").eq("owner_id",user.id).eq("is_profile_store",true).maybeSingle();
 if(storeError)throw storeError;
 if(!store && !createStore)return {profile,store:null,role:await platformRole(user)};
 if(!store){
  const slug="profile-"+user.id.replaceAll("-","");
  const {error}=await db.from("prezzstore_stores").insert({
   owner_id:user.id,slug,name:profile.display_name,description:"Personal listings",
   is_profile_store:true
  });
  if(error && error.code!=="23505")throw error;
  const next=await db.from("prezzstore_stores").select("*").eq("owner_id",user.id)
   .eq("is_profile_store",true).single();
  if(next.error)throw next.error;
  store=next.data;
 }
 return {profile,store,role:await platformRole(user)};
}
