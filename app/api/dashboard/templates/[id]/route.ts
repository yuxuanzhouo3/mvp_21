import { NextRequest, NextResponse } from "next/server";

import {
  buildDashboardTemplatePermissions,
  createDashboardTemplateVersion,
  duplicateDashboardTemplate,
  getDashboardTemplateById,
  updateDashboardTemplate,
} from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const template = await getDashboardTemplateById(auth.user.id, id);
    if (!template) {
      return NextResponse.json(
        { success: false, error: { message: "Template not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        template,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/templates/:id GET] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load template." } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const body = await request.json();
    const permissions = buildDashboardTemplatePermissions({
      subscriptionPlan: auth.user.subscriptionPlan,
      subscriptionStatus: auth.user.subscriptionStatus,
      membershipExpiresAt: auth.user.membershipExpiresAt,
    });

    let template;
    if (body.action === "duplicate") {
      if (!permissions.canCopy) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "Your plan cannot copy templates." },
          },
          { status: 403 },
        );
      }
      template = await duplicateDashboardTemplate(auth.user.id, id);
    } else if (body.action === "create_version") {
      if (!permissions.canCreateVersion) {
        return NextResponse.json(
          {
            success: false,
            error: { message: "Template versioning requires an active paid plan." },
          },
          { status: 403 },
        );
      }
      template = await createDashboardTemplateVersion(auth.user.id, id);
    } else {
      template = await updateDashboardTemplate(auth.user.id, id, {
        name: typeof body.name === "string" ? body.name : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        content: typeof body.content === "string" ? body.content : undefined,
        status:
          body.status === "active" || body.status === "draft" || body.status === "archived"
            ? body.status
            : undefined,
        usageCount:
          typeof body.usageCount === "number" ? body.usageCount : undefined,
        lastUsedAt:
          typeof body.lastUsedAt === "string" || body.lastUsedAt === null
            ? body.lastUsedAt
            : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        template,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "TEMPLATE_WRITE_FORBIDDEN"
        ? "Only templates owned by the current workspace can be changed."
        : error instanceof Error && error.message === "Template not found"
          ? "Template not found."
          : "Failed to update template.";

    return NextResponse.json(
      { success: false, error: { message } },
      {
        status:
          error instanceof Error &&
          (error.message === "TEMPLATE_WRITE_FORBIDDEN" ||
            error.message === "Template not found")
            ? error.message === "Template not found"
              ? 404
              : 403
            : 500,
      },
    );
  }
}
