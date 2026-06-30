import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing.");
    throw new Error("admin-client-unavailable");
  }

  return createClient(getSupabasePublicConfig().url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
