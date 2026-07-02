import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export function getSupabaseAdminKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function createSupabaseAdminClient() {
  const adminKey = getSupabaseAdminKey();

  if (!adminKey) {
    console.error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing.");
    throw new Error("admin-client-unavailable");
  }

  return createClient(getSupabasePublicConfig().url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
