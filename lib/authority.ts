import { admin, currentUser } from "@/lib/supabase";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export type PlatformRole = "owner" | "admin" | null;
export type StudioRole = "owner" | "manager" | "reviewer" | "creator";
const ownerEmails = new Set(["taianderson2000@gmail.com","taizilla@icloud.com"]);

export async function platformRole(user: SessionUser | null): Promise<PlatformRole> {
  if (!user || !user.email || !user.email_confirmed_at) return null;
  const {data,error} = await admin().from("prezzstore_platform_roles")
    .select("role").eq("user_id",user.id).maybeSingle();
  if(error)throw error;
  if(data?.role==="owner" && ownerEmails.has(user.email.toLowerCase()))return "owner";
  if(data?.role==="admin")return "admin";
  return null;
}
export async function studioRole(user:SessionUser, storeId:string):Promise<StudioRole|null> {
  const {data:store,error}=await admin().from("prezzstore_stores")
    .select("owner_id,slug").eq("id",storeId).maybeSingle();
  if(error)throw error;
  if(!store)return null;
  // Reserve the official Zuzify store for PrezzStore platform staff, not regular studio owners or invitees.
  if(store.slug==="zuzify"){
    const role=await platformRole(user);
    return role==="owner"?"owner":role==="admin"?"manager":null;
  }
  if(store.owner_id===user.id)return "owner";
  const {data:staff,error:staffError}=await admin().from("prezzstore_store_managers")
    .select("role").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();
  if(staffError)throw staffError;
  return staff && ["manager","reviewer","creator"].includes(staff.role) ? staff.role as StudioRole : null;
}
export async function canManageStore(user:SessionUser,storeId:string):Promise<boolean>{
  return !!(await studioRole(user,storeId));
}
export async function canEditStore(user:SessionUser,storeId:string):Promise<boolean>{
  return ["owner","manager"].includes((await studioRole(user,storeId))||"");
}
export async function canCreateProduct(user:SessionUser,storeId:string):Promise<boolean>{
  return ["owner","manager","creator"].includes((await studioRole(user,storeId))||"");
}
export async function canApproveProduct(user:SessionUser,storeId:string):Promise<boolean>{
  return ["owner","manager","reviewer"].includes((await studioRole(user,storeId))||"");
}
export async function canManageTeam(user:SessionUser,storeId:string):Promise<boolean>{
  return (await studioRole(user,storeId))==="owner";
}
export async function requireModerator(user:SessionUser|null){
  const role=await platformRole(user);
  return role==="owner"||role==="admin"?role:null;
}

export async function creatorEnrolled(user:SessionUser|null):Promise<boolean>{
 if(!user||!user.email_confirmed_at)return false;
 const {data,error}=await admin().from("prezzstore_user_profiles").select("creator_enrolled").eq("user_id",user.id).maybeSingle();
 if(error)throw error;
 return data?.creator_enrolled===true;
}
