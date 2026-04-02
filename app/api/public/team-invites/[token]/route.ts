import { NextRequest, NextResponse } from "next/server";

import { getPublicDashboardTeamInvitePreview } from "@/lib/data/dashboard-store";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const data = await getPublicDashboardTeamInvitePreview(token, request.nextUrl.origin);
    if (!data) {
      return NextResponse.json(
        { success: false, error: { message: "Workspace invite not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[/api/public/team-invites/[token]] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load workspace invite." } },
      { status: 500 },
    );
  }
}
