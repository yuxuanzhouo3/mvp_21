import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import { getAdminAnalytics } from "@/lib/data/admin-insights-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);
    const data = await getAdminAnalytics(days);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logAdminApiError("Failed to load admin analytics", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load analytics data",
      },
      { status: 500 },
    );
  }
}
