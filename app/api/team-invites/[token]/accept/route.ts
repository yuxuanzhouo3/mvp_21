import { NextRequest, NextResponse } from "next/server";

import { acceptDashboardTeamInvite } from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";
import { observeOperationalMetric } from "@/lib/monitoring/operational-observability";

interface RouteContext {
  params: Promise<{ token: string }>;
}

const errorMap: Record<string, { status: number; message: string }> = {
  TEAM_INVITE_NOT_FOUND: { status: 404, message: "Workspace invite not found." },
  TEAM_INVITE_REVOKED: { status: 410, message: "This invite has been revoked." },
  TEAM_INVITE_ACCEPTED: { status: 409, message: "This invite has already been accepted." },
  TEAM_INVITE_EXPIRED: { status: 410, message: "This invite has expired." },
  TEAM_INVITE_EMAIL_MISMATCH: {
    status: 403,
    message: "Please sign in with the invited email address before accepting.",
  },
  TEAM_INVITE_WORKSPACE_CONFLICT: {
    status: 409,
    message: "Your account already belongs to another workspace.",
  },
};

export async function POST(request: NextRequest, context: RouteContext) {
  const operationId = `invite_accept_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startedAt = Date.now();
  const observe = (
    outcome: "success" | "failure" | "rejected",
    statusCode: number,
    meta?: Record<string, unknown>,
    userId?: string,
  ) => {
    observeOperationalMetric({
      chain: "team_invite_accept",
      outcome,
      statusCode,
      operationId,
      userId,
      durationMs: Date.now() - startedAt,
      metadata: meta,
    });
  };

  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      const status = auth.error?.status ?? 401;
      observe("rejected", status, { reason: "auth_required" });
      return (
        auth.error ||
        NextResponse.json(
          { success: false, error: { message: "Authentication required." } },
          { status },
        )
      );
    }

    const { token } = await context.params;
    const data = await acceptDashboardTeamInvite(auth.user, token, request.nextUrl.origin);
    observe("success", 200, { token }, auth.user.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const mapped =
      error instanceof Error && errorMap[error.message]
        ? errorMap[error.message]
        : { status: 500, message: "Failed to accept workspace invite." };
    observe(
      mapped.status >= 500 ? "failure" : "rejected",
      mapped.status,
      {
        reason: "accept_failed",
        error: error instanceof Error ? error.message : "unknown",
      },
    );

    return NextResponse.json(
      { success: false, error: { message: mapped.message } },
      { status: mapped.status },
    );
  }
}
