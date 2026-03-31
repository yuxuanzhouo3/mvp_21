import { NextRequest, NextResponse } from "next/server";

import {
  removeDashboardTeamMember,
  updateDashboardTeamMember,
} from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const body = await request.json();

    const team = await updateDashboardTeamMember(auth.user, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      role:
        body.role === "owner" || body.role === "admin" || body.role === "member"
          ? body.role
          : undefined,
      status:
        body.status === "active" || body.status === "invited" || body.status === "suspended"
          ? body.status
          : undefined,
    });

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    const messageMap: Record<string, { status: number; message: string }> = {
      TEAM_MEMBER_NOT_FOUND: { status: 404, message: "Team member not found." },
      TEAM_OWNER_IMMUTABLE: { status: 403, message: "Workspace owner cannot be changed here." },
      TEAM_ROLE_FORBIDDEN: { status: 403, message: "You do not have permission to change roles." },
      TEAM_STATUS_FORBIDDEN: { status: 403, message: "You do not have permission to change member status." },
      TEAM_MEMBER_PROTECTED: { status: 403, message: "This member cannot be managed with your current role." },
    };
    const mapped =
      error instanceof Error && messageMap[error.message]
        ? messageMap[error.message]
        : { status: 500, message: "Failed to update team member." };

    return NextResponse.json(
      { success: false, error: { message: mapped.message } },
      { status: mapped.status },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const team = await removeDashboardTeamMember(auth.user, id);

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    const messageMap: Record<string, { status: number; message: string }> = {
      TEAM_MEMBER_NOT_FOUND: { status: 404, message: "Team member not found." },
      TEAM_OWNER_IMMUTABLE: { status: 403, message: "Workspace owner cannot be removed." },
      TEAM_REMOVE_FORBIDDEN: { status: 403, message: "You do not have permission to remove members." },
      TEAM_MEMBER_PROTECTED: { status: 403, message: "This member cannot be removed with your current role." },
    };
    const mapped =
      error instanceof Error && messageMap[error.message]
        ? messageMap[error.message]
        : { status: 500, message: "Failed to remove team member." };

    return NextResponse.json(
      { success: false, error: { message: mapped.message } },
      { status: mapped.status },
    );
  }
}
