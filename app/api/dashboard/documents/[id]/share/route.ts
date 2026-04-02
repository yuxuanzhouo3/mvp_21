import { NextRequest, NextResponse } from "next/server";

import {
  createDashboardDocumentShareLink,
  revokeDashboardDocumentShareLink,
} from "@/lib/data/dashboard-documents-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      expiresAt?: string | null;
      expiresInDays?: number | null;
    };
    const expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt.trim()
        ? body.expiresAt
        : typeof body.expiresInDays === "number" && Number.isFinite(body.expiresInDays)
          ? new Date(Date.now() + Math.max(1, body.expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
          : null;
    const share = await createDashboardDocumentShareLink(auth.user.id, id, request.nextUrl.origin, {
      expiresAt,
    });
    if (!share) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: share,
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]/share] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create share link." } },
      { status: 500 },
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
    const revoked = await revokeDashboardDocumentShareLink(auth.user.id, id);
    if (!revoked) {
      return NextResponse.json(
        { success: false, error: { message: "Share link not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        revoked: true,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]/share] Failed to revoke share link:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to revoke share link." } },
      { status: 500 },
    );
  }
}
