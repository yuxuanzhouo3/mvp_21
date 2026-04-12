import { isInternationalDeployment } from "@/lib/config/deployment.config";

interface SupabaseRuntimeOptions {
  context: string;
  requireServiceRole?: boolean;
}

interface SupabaseRuntimeEnv {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  strictMode: boolean;
}

function buildMissingKeys(options: SupabaseRuntimeOptions, env: SupabaseRuntimeEnv) {
  const missing: string[] = [];
  if (!env.url) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!env.anonKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (options.requireServiceRole && !env.serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  return missing;
}

export function readSupabaseRuntimeEnv(
  options: SupabaseRuntimeOptions,
): SupabaseRuntimeEnv {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    strictMode:
      process.env.NODE_ENV === "production" && isInternationalDeployment(),
  };
}

export function assertSupabaseRuntimeEnv(options: SupabaseRuntimeOptions): SupabaseRuntimeEnv {
  const env = readSupabaseRuntimeEnv(options);
  const missing = buildMissingKeys(options, env);

  if (missing.length === 0) {
    return env;
  }

  const baseMessage =
    `[${options.context}] Missing Supabase runtime env: ${missing.join(", ")}. ` +
    "Please configure them in deployment environment variables.";

  if (env.strictMode) {
    throw new Error(baseMessage);
  }

  console.warn(baseMessage);
  return env;
}

