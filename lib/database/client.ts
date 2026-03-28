import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

/**
 * Shared server-side database client used by admin routes.
 */
export async function createClient() {
  return getSupabaseAdmin();
}
