import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import {
  createAdminVersion,
  listAdminVersions,
} from "@/lib/data/admin-management-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const versions = await listAdminVersions();

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    logAdminApiError("Failed to fetch admin versions", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch versions",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const body = await request.json();
    const {
      platform,
      version,
      buildNumber,
      fileUrl,
      fileSize,
      changelog,
      forceUpdate,
    } = body;

    if (!platform || !version || !fileUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 },
      );
    }

    const created = await createAdminVersion({
      platform,
      version,
      buildNumber,
      fileUrl,
      fileSize,
      changelog,
      forceUpdate,
    });

    logAdminAudit("Admin created version", auditContext, {
      platform,
      version,
    });

    return NextResponse.json({
      success: true,
      data: created,
    });
  } catch (error) {
    logAdminApiError("Failed to create admin version", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create version",
      },
      { status: 500 },
    );
  }
}
