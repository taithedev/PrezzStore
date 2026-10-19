import { admin } from "@/lib/supabase";

/**
 * Earned, store-scoped status. SQL derives it from completed paid, nonrefunded orders
 * and the current listing/store state. No browser input can enable discounts.
 */
export type CreatorPlusStatus={
  sales_30d_cents:number; sales_30d_count:number; unique_buyers_30d:number;
  published_listings:number; store_age_days:number; active_store:boolean; qualified:boolean;
};
export const programRequirements={
  cents:5000, orders:3, buyers:2, listings:2, ageDays:14
} as const;
export async function creatorPlusStatus(storeId:string):Promise<CreatorPlusStatus>{
  const {data,error}=await admin().rpc("prezzstore_creator_plus_status",{p_store:storeId});
  if(error)throw error;
  const status=Array.isArray(data)?data[0]:data;
  if(!status)throw new Error("Store eligibility could not be evaluated");
  const {data:store,error:storeError}=await admin().from("prezzstore_stores").select("owner_id").eq("id",storeId).maybeSingle();
  if(storeError)throw storeError;
  const {data:grant,error:grantError}=store?.owner_id
    ?await admin().from("prezzstore_creator_plus_grants").select("user_id").eq("user_id",store.owner_id).maybeSingle()
    :{data:null,error:null};
  if(grantError)throw grantError;
  return {
    sales_30d_cents:Number(status.sales_30d_cents)||0,
    sales_30d_count:Number(status.sales_30d_count)||0,
    unique_buyers_30d:Number(status.unique_buyers_30d)||0,
    published_listings:Number(status.published_listings)||0,
    store_age_days:Number(status.store_age_days)||0,
    active_store:status.active_store===true,
    qualified:status.qualified===true || !!grant
  };
}
export function creatorPlusFeeBps(base:number,qualified:boolean):number{
  return qualified?Math.min(base,500):base;
}
export function collaboratorLimit(qualified:boolean):number{
  return qualified?10:3;
}
