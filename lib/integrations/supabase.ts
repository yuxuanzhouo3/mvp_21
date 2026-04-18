import { createClient } from "@supabase/supabase-js";
import { isInternationalDeployment } from "@/lib/config/deployment.config";
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime";

let supabaseInstance: ReturnType<typeof createClient> | null = null;
let missingEnvWarningShown = false;

function shouldWarnMissingSupabaseEnv() {
  return isInternationalDeployment();
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

  const env = assertSupabaseRuntimeEnv({
    context: "supabase-client",
  });
  const supabaseUrl = env.url;
  const supabaseAnonKey = env.anonKey;

  warnMissingSupabaseEnv(supabaseUrl, supabaseAnonKey);

  const fallbackUrl = env.strictMode ? "" : "https://placeholder.supabase.co";
  const fallbackKey = env.strictMode ? "" : "placeholder-key";

  if ((!supabaseUrl || !supabaseAnonKey) && env.strictMode) {
    throw new Error(
      "[supabase-client] Supabase client initialization blocked: missing required URL/ANON key.",
    );
  }

  supabaseInstance = createClient(
    supabaseUrl || fallbackUrl,
    supabaseAnonKey || fallbackKey,
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
