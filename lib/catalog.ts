import { admin, configured } from "./supabase";
import { demo } from "./demo";
import type { Product, Store } from "./types";
export async function allProducts(): Promise<{ items: Product[]; preview: boolean }> {
  if (!configured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { items: demo, preview: true };
  const { data, error } = await admin().from("prezz_products").select("*, store:prezz_stores(*)").eq("published", true).order("created_at", { ascending: false }).limit(80);
  if (error) { console.error("Catalog query failed:", error.message); return { items: [], preview: false }; }
  return { items: (data || []) as Product[], preview: false };
}
export async function productById(id: string): Promise<Product | null> {
  if (id.startsWith("preview-")) return demo.find(x => x.id === id) || null;
  if (!configured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await admin().from("prezz_products").select("*, store:prezz_stores(*)").eq("id", id).eq("published", true).maybeSingle();
  return (data || null) as Product | null;
}
export async function storeBySlug(slug: string): Promise<Store | null> {
  if (!configured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await admin().from("prezz_stores").select("*").eq("slug", slug).maybeSingle();
  return data as Store | null;
}