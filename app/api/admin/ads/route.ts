import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import {
  createAdminAd,
  getAdminAdsMetrics,
  listAdminAds,
} from "@/lib/data/admin-insights-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(Number(searchParams.get("days") || "7"), 7), 30);
    const [metrics, items] = await Promise.all([
      getAdminAdsMetrics(days),
      listAdminAds(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...metrics,
        items,
      },
    });
  } catch (error) {
    logAdminApiError("Failed to load ad metrics", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load ad metrics",
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
    const body = (await request.json()) as Record<string, any>;

    if (!body.name || !body.position || !body.type) {
      return NextResponse.json(
        {
          success: false,
          error: "name, position, and type are required",
        },
        { status: 400 },
      );
    }

    const ad = await createAdminAd({
      name: body.name,
      position: body.position,
      type: body.type,
      content: body.content,
      link: body.link,
      status: body.status,
      start_date: body.start_date,
      end_date: body.end_date,
    });

    logAdminAudit("Admin created ad", auditContext, {
      adName: body.name,
      position: body.position,
      type: body.type,
    });

    return NextResponse.json({
      success: true,
      data: {
        ad,
      },
    });
  } catch (error) {
    logAdminApiError("Failed to create admin ad", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create ad",
      },
      { status: 500 },
    );
  }
}
