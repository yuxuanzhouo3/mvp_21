import { DEFAULT_ADMIN_SETTINGS, normalizeAdminSettings, type AdminSettings } from "@/lib/admin/settings-schema";
import { getDatabase } from "@/lib/cloudbase/cloudbase-service";
import { isChinaRegion } from "@/lib/config/region";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

const SETTINGS_KEY = "global";

export async function loadAdminSettings(): Promise<AdminSettings> {
  try {
    if (isChinaRegion()) {
      const db = getDatabase();
      const result = await db
        .collection("admin_settings")
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
    const existing = await db
      .collection("admin_settings")
      .where({ key: SETTINGS_KEY })
      .limit(1)
      .get();

    const row = existing.data?.[0] as Record<string, unknown> | undefined;
    if (row?._id && typeof row._id === "string") {
      await db.collection("admin_settings").doc(row._id).update({
        payload,
        updated_at: updatedAt,
      });
    } else {
      await db.collection("admin_settings").add({
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
