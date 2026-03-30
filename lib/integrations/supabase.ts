import { createClient } from "@supabase/supabase-js";
import { isInternationalDeployment } from "@/lib/config/deployment.config";

let supabaseInstance: ReturnType<typeof createClient> | null = null;
let missingEnvWarningShown = false;

function shouldWarnMissingSupabaseEnv() {
  return isInternationalDeployment() || process.env.NODE_ENV === "production";
}

function warnMissingSupabaseEnv(supabaseUrl: string, supabaseAnonKey: string) {
  if (!shouldWarnMissingSupabaseEnv() || missingEnvWarningShown) {
    return;
  }

  const missing: string[] = [];

  if (!supabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  if (missing.length === 0) {
    return;
  }

  missingEnvWarningShown = true;
  console.warn(
    `[Supabase] Missing ${missing.join(", ")}. ` +
      "If this deployment uses Supabase, please configure them in the deployment platform. " +
      "CN / CloudBase deployments can ignore this warning.",
  );
}

export function getSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  warnMissingSupabaseEnv(supabaseUrl, supabaseAnonKey);

  supabaseInstance = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );

  return supabaseInstance;
}

export const supabase = new Proxy({} as any, {
  get: (_target, prop) => {
    const client = getSupabaseClient();
    return client[prop as keyof typeof client];
  },
});
