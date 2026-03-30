import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import {
  deleteAdminAdById,
  getAdminAdById,
  updateAdminAdById,
} from "@/lib/data/admin-insights-store";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await context.params;
    const ad = await getAdminAdById(id);

    if (!ad) {
      return NextResponse.json(
        { success: false, error: { message: "Ad not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { ad },
    });
  } catch (error) {
    logAdminApiError("Failed to fetch admin ad", error, auditContext);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch ad" } },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await context.params;
    const body = await request.json();

    const existing = await getAdminAdById(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Ad not found" } },
        { status: 404 },
      );
    }

    const ad = await updateAdminAdById(id, {
      name: body.name,
      position: body.position,
      type: body.type,
      content: body.content,
      link: body.link,
      status: body.status,
      start_date: body.start_date,
      end_date: body.end_date,
    });

    logAdminAudit("Admin updated ad", auditContext, { adId: id });

    return NextResponse.json({
      success: true,
      data: { ad },
    });
  } catch (error) {
    logAdminApiError("Failed to update admin ad", error, auditContext);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update ad" } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { id } = await context.params;
    const existing = await getAdminAdById(id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Ad not found" } },
        { status: 404 },
      );
    }

    await deleteAdminAdById(id);
    logAdminAudit("Admin deleted ad", auditContext, { adId: id });

    return NextResponse.json({
      success: true,
      data: { message: "Ad deleted successfully" },
    });
  } catch (error) {
    logAdminApiError("Failed to delete admin ad", error, auditContext);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete ad" } },
      { status: 500 },
    );
  }
}
