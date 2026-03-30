import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import { listAdminAuditLogs } from "@/lib/data/admin-audit-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page") || "1"), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || "20"), 1), 100);
    const status = searchParams.get("status") || "all";

    const { items, total } = await listAdminAuditLogs({
      page,
      limit,
      status,
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
      },
    });
  } catch (error) {
    logAdminApiError("Failed to fetch admin audit logs", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch admin audit logs",
      },
      { status: 500 },
    );
  }
}
