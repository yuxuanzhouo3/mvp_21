import { NextRequest, NextResponse } from "next/server";

import {
  buildDashboardTemplatePermissions,
  createDashboardTemplate,
  listDashboardTemplates,
} from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const templates = await listDashboardTemplates(auth.user.id);
    return NextResponse.json({
      success: true,
      data: {
        templates,
        permissions: buildDashboardTemplatePermissions(),
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/templates] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load templates." } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const body = await request.json();
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Template name is required." } },
        { status: 400 },
      );
    }

    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Template content is required." } },
        { status: 400 },
      );
    }

    const template = await createDashboardTemplate(auth.user.id, {
      name: body.name,
      description: typeof body.description === "string" ? body.description : "",
      category: typeof body.category === "string" ? body.category : "General",
      content: body.content,
    });

    return NextResponse.json({
      success: true,
      data: {
        template,
        permissions: buildDashboardTemplatePermissions(),
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/templates POST] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create template." } },
      { status: 500 },
    );
  }
}
