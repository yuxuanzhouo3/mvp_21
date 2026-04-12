import { createClient } from "@supabase/supabase-js";
import { isInternationalDeployment } from "@/lib/config/deployment.config";
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime";

// Server-side Supabase client with service-role access for admin operations.
// Do not import this module into client components.

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const env = assertSupabaseRuntimeEnv({
    context: "supabase-admin",
    requireServiceRole: true,
  });
  const supabaseUrl = env.url;
  const serviceRoleKey = env.serviceRoleKey;
  const anonKey = env.anonKey;

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

  const fallbackUrl = env.strictMode ? "" : "https://placeholder.supabase.co";
  const fallbackKey = env.strictMode ? "" : "placeholder-key";

  if ((!supabaseUrl || !serviceRoleKey) && env.strictMode) {
    throw new Error(
      "[supabase-admin] Supabase admin initialization blocked: missing URL or SERVICE_ROLE key.",
    );
  }

  supabaseAdminInstance = createClient(
    supabaseUrl || fallbackUrl,
    serviceRoleKey || anonKey || fallbackKey,
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
