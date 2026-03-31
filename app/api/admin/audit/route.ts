import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import {
  buildAdminAuditSummary,
  convertAdminAuditLogsToCsv,
  listAdminAuditLogs,
} from "@/lib/data/admin-audit-store";

function buildExportFilename(format: "csv" | "json") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `admin-audit-${timestamp}.${format}`;
}

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
    const format = searchParams.get("format");
    const exportMode = format === "csv" || format === "json";
    const rawLimit = Number(searchParams.get("limit") || (exportMode ? "5000" : "20"));
    const limit = Math.min(Math.max(rawLimit, 1), exportMode ? 5000 : 100);
    const status = searchParams.get("status") || "all";

    const { items, total } = await listAdminAuditLogs({
      page,
      limit,
      status,
    });
    const summary = buildAdminAuditSummary(items);

    if (exportMode) {
      logAdminAudit("Admin exported audit logs", auditContext, {
        format,
        status,
        recordCount: items.length,
      });

      if (format === "csv") {
        return new NextResponse(convertAdminAuditLogsToCsv(items), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${buildExportFilename("csv")}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          exportedAt: new Date().toISOString(),
          filters: { status },
          summary,
          items,
        },
        {
          headers: {
            "Content-Disposition": `attachment; filename="${buildExportFilename("json")}"`,
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        summary,
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
