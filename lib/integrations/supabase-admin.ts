import { createClient } from "@supabase/supabase-js";
import { isInternationalDeployment } from "@/lib/config/deployment.config";
import { assertSupabaseRuntimeEnv } from "@/lib/config/supabase-runtime";

// Server-side Supabase client with service-role access for admin operations.
// Do not import this module into client components.

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;
const ensuredBuckets = new Set<string>();
const ensuringBuckets = new Map<string, Promise<void>>();

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

export async function ensureSupabaseStorageBucket(
  bucketName: string,
  options?: { public?: boolean; fileSizeLimit?: string; allowedMimeTypes?: string[] },
) {
  if (!bucketName) {
    throw new Error("Bucket name is required.");
  }

  if (ensuredBuckets.has(bucketName)) {
    return;
  }

  const inFlight = ensuringBuckets.get(bucketName);
  if (inFlight) {
    await inFlight;
    return;
  }

  const task = (async () => {
    const admin = getSupabaseAdmin() as any;
    const desiredPublic = options?.public ?? true;

    const { data: existingBucket, error: getError } = await admin.storage.getBucket(bucketName);
    if (!getError && existingBucket) {
      ensuredBuckets.add(bucketName);
      return;
    }

    const errorMessage = String(getError?.message || "").toLowerCase();
    const statusCode = Number(getError?.statusCode || getError?.status || 0);
    const isNotFound = statusCode === 404 || errorMessage.includes("not found");

    if (!isNotFound && getError) {
      throw getError;
    }

    const { error: createError } = await admin.storage.createBucket(bucketName, {
      public: desiredPublic,
      fileSizeLimit: options?.fileSizeLimit,
      allowedMimeTypes: options?.allowedMimeTypes,
    });

    if (createError) {
      const createMsg = String(createError.message || "").toLowerCase();
      const alreadyExists =
        createMsg.includes("already exists") ||
        createMsg.includes("duplicate") ||
        createMsg.includes("conflict");

      if (!alreadyExists) {
        throw createError;
      }
    }

    ensuredBuckets.add(bucketName);
  })();

  ensuringBuckets.set(bucketName, task);
  try {
    await task;
  } finally {
    ensuringBuckets.delete(bucketName);
  }
}
