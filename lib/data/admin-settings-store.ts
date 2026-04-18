import { DEFAULT_ADMIN_SETTINGS, normalizeAdminSettings, type AdminSettings } from "@/lib/admin/settings-schema";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

const SETTINGS_KEY = "global";
const SETTINGS_COLLECTION = "admin_settings";

function isMissingCollectionError(error: unknown): boolean {
  const code = String((error as any)?.code || "");
  const message = String((error as any)?.message || "");
  return (
    code.includes("DATABASE_COLLECTION_NOT_EXIST") ||
    message.includes("DATABASE_COLLECTION_NOT_EXIST") ||
    message.includes("Db or Table not exist")
  );
}

async function ensureCnSettingsCollection(db: any): Promise<void> {
  try {
    await db.collection(SETTINGS_COLLECTION).limit(1).get();
    return;
  } catch (error) {
    if (!isMissingCollectionError(error)) {
      throw error;
    }
  }

  try {
    await db.createCollection(SETTINGS_COLLECTION);
  } catch (error) {
    const code = String((error as any)?.code || "");
    const message = String((error as any)?.message || "");
    const alreadyExists =
      code.includes("DATABASE_COLLECTION_ALREADY_EXIST") ||
      message.includes("already exists");

    if (!alreadyExists) {
      throw error;
    }
  }
}

export async function loadAdminSettings(): Promise<AdminSettings> {
  try {
    if (isChinaRegion()) {
      const db = getDatabase();
      await ensureCnSettingsCollection(db);
      const result = await db
        .collection(SETTINGS_COLLECTION)
        .where({ key: SETTINGS_KEY })
        .limit(1)
        .get();

      const row = result.data?.[0] as Record<string, unknown> | undefined;
      if (!row) {
        return DEFAULT_ADMIN_SETTINGS;
      }

      return normalizeAdminSettings(row.payload || row.settings || row.value || row);
    }

    const admin = getSupabaseAdmin() as any;
    const { data, error } = await admin
      .from("admin_settings")
      .select("key,payload,updated_at")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_ADMIN_SETTINGS;
    }

    return normalizeAdminSettings({
      ...(typeof data.payload === "object" && data.payload ? data.payload : {}),
      updatedAt: data.updated_at,
    });
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export async function saveAdminSettings(settings: AdminSettings): Promise<AdminSettings> {
  const payload = normalizeAdminSettings(settings);
  const updatedAt = new Date().toISOString();

  if (isChinaRegion()) {
    const db = getDatabase();
    await ensureCnSettingsCollection(db);
    const existing = await db
      .collection(SETTINGS_COLLECTION)
      .where({ key: SETTINGS_KEY })
      .limit(1)
      .get();

    const row = existing.data?.[0] as Record<string, unknown> | undefined;
    if (row?._id && typeof row._id === "string") {
      await db.collection(SETTINGS_COLLECTION).doc(row._id).update({
        payload,
        updated_at: updatedAt,
      });
    } else {
      await db.collection(SETTINGS_COLLECTION).add({
        key: SETTINGS_KEY,
        payload,
        updated_at: updatedAt,
        created_at: updatedAt,
      });
    }

    return {
      ...payload,
      updatedAt,
    };
  }

  const admin = getSupabaseAdmin() as any;
  const { error } = await admin.from("admin_settings").upsert(
    {
      key: SETTINGS_KEY,
      payload,
      updated_at: updatedAt,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw error;
  }

  return {
    ...payload,
    updatedAt,
  };
}
