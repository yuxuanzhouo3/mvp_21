import { NextRequest, NextResponse } from "next/server";

import { getDashboardDocumentVerificationData } from "@/lib/data/dashboard-documents-store";
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
    const data = await getDashboardDocumentVerificationData(auth.user.id, id, request.nextUrl.origin);
    if (!data) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]/verify] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load document verification." } },
      { status: 500 },
    );
  }
}
