import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getPublicSupabaseConfig } from "./config";

export async function createClient() {
  const { url, key, configured } = getPublicSupabaseConfig();
  if (!configured) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Proxy refreshes cookies for Server Components. */ }
      },
    },
  });
}
