import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase backend is not configured");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function server() {
  if (!configured) return null;
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return jar.getAll(); },
      setAll(items) {
        try { items.forEach(({name, value, options}) => jar.set(name, value, options)); }
        catch { /* Cookies can't be set from a Server Component; route handlers can */ }
      }
    }
  });
}
export async function currentUser() {
  const db = await server();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  return user;
}