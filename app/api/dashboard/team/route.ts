import { NextRequest, NextResponse } from "next/server";

import {
  inviteDashboardTeamMember,
  listDashboardTeamMembers,
} from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const team = await listDashboardTeamMembers(auth.user);
    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error("[/api/dashboard/team] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load team members." } },
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
    if (typeof body.email !== "string" || !body.email.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Member email is required." } },
        { status: 400 },
      );
    }

    const team = await inviteDashboardTeamMember(auth.user, {
      email: body.email,
      name: typeof body.name === "string" ? body.name : undefined,
      role: body.role === "admin" || body.role === "member" ? body.role : undefined,
    });

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "TEAM_INVITE_FORBIDDEN"
        ? "You do not have permission to invite members."
        : error instanceof Error && error.message === "TEAM_EMAIL_REQUIRED"
          ? "Member email is required."
          : "Failed to invite member.";

    return NextResponse.json(
      { success: false, error: { message } },
      {
        status:
          error instanceof Error &&
          (error.message === "TEAM_INVITE_FORBIDDEN" ||
            error.message === "TEAM_EMAIL_REQUIRED")
            ? error.message === "TEAM_EMAIL_REQUIRED"
              ? 400
              : 403
            : 500,
      },
    );
  }
}
