import { createClient } from "@supabase/supabase-js";
import { isInternationalDeployment } from "@/lib/config/deployment.config";

// Server-side Supabase client with service-role access for admin operations.
// Do not import this module into client components.

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (isInternationalDeployment() && process.env.NODE_ENV === "production" && !supabaseUrl) {
    console.warn(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Please configure it in the deployment environment.",
    );
  }

  if (isInternationalDeployment() && process.env.NODE_ENV === "production" && !serviceRoleKey) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Admin writes may fall back to ANON_KEY and fail under RLS.",
    );
  }

  supabaseAdminInstance = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    serviceRoleKey || anonKey || "placeholder-key",
    {
      auth: { persistSession: false },
    },
  );

  return supabaseAdminInstance;
}

export const supabaseAdmin = new Proxy({} as any, {
  get: (_target, prop) => {
    const admin = getSupabaseAdmin();
    return admin[prop as keyof typeof admin];
  },
});
