import {admin} from "@/lib/supabase";
export async function isPlatformStore(store:{id:string;slug?:string;owner_id:string;is_profile_store?:boolean}|null|undefined){
 if(!store||store.id!=="2493d64a-1221-4440-873e-8e713256ef08"||store.slug!=="zuzify"||store.is_profile_store)return false;
 const {data,error}=await admin().from("prezzstore_platform_roles").select("role").eq("user_id",store.owner_id).maybeSingle();
 if(error)throw error;
 return data?.role==="owner";
}
