import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import { getAdminOverviewStats } from "@/lib/data/admin-insights-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const data = await getAdminOverviewStats();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logAdminApiError("Failed to load admin stats", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load admin stats",
      },
      { status: 500 },
    );
  }
}
