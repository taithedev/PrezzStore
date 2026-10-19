import { admin, currentUser } from "@/lib/supabase";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
export type PlatformRole = "owner" | "admin" | null;
const ownerEmails = new Set(["taianderson2000@gmail.com","taizilla@icloud.com"]);

export async function platformRole(user: SessionUser | null): Promise<PlatformRole> {
  if (!user || !user.email || !user.email_confirmed_at) return null;
  const { data, error } = await admin().from("prezzstore_platform_roles")
    .select("role").eq("user_id",user.id).maybeSingle();
  if (error) throw error;
  if (data?.role === "owner" && ownerEmails.has(user.email.toLowerCase())) return "owner";
  if (data?.role === "admin") return "admin";
  return null;
}
export async function canManageStore(user: SessionUser, storeId: string): Promise<boolean> {
  const { data:store } = await admin().from("prezzstore_stores")
    .select("owner_id,slug").eq("id",storeId).maybeSingle();
  if (!store) return false;
  if (store.owner_id === user.id) return true;
  if (store.slug === "zuzify" && await platformRole(user) === "owner") return true;
  const { data:staff } = await admin().from("prezzstore_store_managers")
    .select("user_id").eq("store_id",storeId).eq("user_id",user.id).maybeSingle();
  return Boolean(staff);
}
export async function canManageTeam(user: SessionUser,storeId: string): Promise<boolean> {
  const {data:store} = await admin().from("prezzstore_stores")
    .select("owner_id,slug").eq("id",storeId).maybeSingle();
  return !!store && (store.owner_id === user.id || (store.slug === "zuzify" && await platformRole(user) === "owner"));
}
export async function requireModerator(user: SessionUser | null) {
  const role = await platformRole(user);
  return role === "owner" || role === "admin" ? role : null;
}
