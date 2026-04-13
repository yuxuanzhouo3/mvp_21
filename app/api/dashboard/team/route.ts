import { NextRequest, NextResponse } from "next/server";

import {
  inviteDashboardTeamMember,
  listDashboardTeamMembers,
} from "@/lib/data/dashboard-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

function readErrorMessage(error: unknown) {
  if (!error) {
    return "";
  }

  if (error instanceof Error) {
    return error.message || "";
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }

  return "";
}

function readErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }

  return "";
}

function isTeamStorageNotReady(error: unknown) {
  const code = readErrorCode(error).toUpperCase();
  if (code === "42P01" || code === "PGRST205") {
    return true;
  }

  const message = readErrorMessage(error).toLowerCase();
  if (!message) {
    return false;
  }

  const mentionsTeamStorage =
    message.includes("workspace_invites") || message.includes("workspace_members");
  const missingKeywords = [
    "does not exist",
    "not exist",
    "not found",
    "relation",
    "collection",
  ];

  return mentionsTeamStorage && missingKeywords.some((keyword) => message.includes(keyword));
}

function isTeamStoragePermissionDenied(error: unknown) {
  const code = readErrorCode(error).toUpperCase();
  if (code === "42501") {
    return true;
  }

  const message = readErrorMessage(error).toLowerCase();
  const mentionsTeamStorage =
    message.includes("workspace_invites") || message.includes("workspace_members");
  return mentionsTeamStorage && message.includes("permission denied");
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const team = await listDashboardTeamMembers(auth.user, request.nextUrl.origin);
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
    }, request.nextUrl.origin);

    return NextResponse.json({
      success: true,
      data: team,
    });
  } catch (error) {
    console.error("[/api/dashboard/team] Invite failed:", error);

    const message =
      error instanceof Error && error.message === "TEAM_INVITE_FORBIDDEN"
        ? "You do not have permission to invite members."
        : error instanceof Error && error.message === "TEAM_EMAIL_REQUIRED"
          ? "Member email is required."
          : error instanceof Error && error.message === "TEAM_MEMBER_ALREADY_ACTIVE"
            ? "This email is already an active workspace member."
          : isTeamStorageNotReady(error)
            ? "Team invite storage is not initialized. Please run the latest workspace team database migrations."
            : isTeamStoragePermissionDenied(error)
              ? "Team invite write is blocked by database permissions. Please verify SUPABASE_SERVICE_ROLE_KEY and table policies."
          : "Failed to invite member.";

    return NextResponse.json(
      { success: false, error: { message } },
      {
        status:
          error instanceof Error &&
          (error.message === "TEAM_INVITE_FORBIDDEN" ||
            error.message === "TEAM_EMAIL_REQUIRED" ||
            error.message === "TEAM_MEMBER_ALREADY_ACTIVE")
            ? error.message === "TEAM_EMAIL_REQUIRED"
              ? 400
              : error.message === "TEAM_MEMBER_ALREADY_ACTIVE"
                ? 409
              : 403
            : isTeamStorageNotReady(error)
              ? 503
            : 500,
      },
    );
  }
}
