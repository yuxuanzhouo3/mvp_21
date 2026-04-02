import { NextRequest, NextResponse } from "next/server";

import { normalizeAdminSettings } from "@/lib/admin/settings-schema";
import { requireAdmin, logAdminApiError, logAdminAudit } from "@/lib/auth/admin-auth";
import { loadAdminSettings, saveAdminSettings } from "@/lib/data/admin-settings-store";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const settings = await loadAdminSettings();
    logAdminAudit("admin_settings_loaded", auth.auditContext);

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logAdminApiError("admin_settings_load_failed", error, auth.auditContext);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to load system settings." },
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const settings = normalizeAdminSettings(body);
    const saved = await saveAdminSettings(settings);

    logAdminAudit("admin_settings_updated", auth.auditContext, {
      platformName: saved.general.platformName,
      domain: saved.general.domain,
    });

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error) {
    logAdminApiError("admin_settings_update_failed", error, auth.auditContext);
    return NextResponse.json(
      {
        success: false,
        error: { message: "Failed to save system settings." },
      },
      { status: 500 },
    );
  }
}
