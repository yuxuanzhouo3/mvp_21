import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import {
  deleteAdminVersion,
  updateAdminVersion,
} from "@/lib/data/admin-management-store";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let auditContext: AdminAuditContext | undefined;
  let versionId = "";

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await params;
    versionId = id;
    const body = await request.json();
    const version = await updateAdminVersion(id, body);

    if (!version) {
      return NextResponse.json(
        {
          success: false,
          error: "Version not found",
        },
        { status: 404 },
      );
    }

    logAdminAudit("Admin updated version", auditContext, {
      versionId: id,
    });

    return NextResponse.json({
      success: true,
      data: version,
    });
  } catch (error) {
    logAdminApiError("Failed to update admin version", error, auditContext, {
      versionId,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update version",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let auditContext: AdminAuditContext | undefined;
  let versionId = "";

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await params;
    versionId = id;
    await deleteAdminVersion(id);
    logAdminAudit("Admin deleted version", auditContext, {
      versionId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Version deleted successfully",
    });
  } catch (error) {
    logAdminApiError("Failed to delete admin version", error, auditContext, {
      versionId,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete version",
      },
      { status: 500 },
    );
  }
}
