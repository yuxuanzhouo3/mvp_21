import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import { listAdminUsers } from "@/lib/data/admin-management-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const search = searchParams.get("search") || "";
    const subscriptionType = searchParams.get("subscription_type") || "";

    const data = await listAdminUsers({
      page,
      limit,
      search,
      subscriptionType,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logAdminApiError("Failed to fetch admin users", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user list",
      },
      { status: 500 },
    );
  }
}
