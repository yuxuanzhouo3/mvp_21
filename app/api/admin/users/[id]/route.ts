import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import {
  deleteAdminUser,
  getAdminUserDetails,
  updateAdminUser,
} from "@/lib/data/admin-management-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let auditContext: AdminAuditContext | undefined;
  let targetUserId = "";

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await params;
    targetUserId = id;
    const details = await getAdminUserDetails(id);
    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    logAdminApiError("Failed to fetch admin user details", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user details",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let auditContext: AdminAuditContext | undefined;
  let targetUserId = "";

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await params;
    targetUserId = id;
    const body = await request.json();
    const details = await updateAdminUser(id, body);

    logAdminAudit("Admin updated user", auditContext, { targetUserId: id });

    return NextResponse.json({
      success: true,
      data: details,
      message: "User updated successfully",
    });
  } catch (error) {
    logAdminApiError("Failed to update admin user", error, auditContext, {
      targetUserId,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update user",
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
  let targetUserId = "";

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await params;
    targetUserId = id;
    await deleteAdminUser(id);
    logAdminAudit("Admin deleted user", auditContext, { targetUserId: id });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logAdminApiError("Failed to delete admin user", error, auditContext, {
      targetUserId,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete user",
      },
      { status: 500 },
    );
  }
}
