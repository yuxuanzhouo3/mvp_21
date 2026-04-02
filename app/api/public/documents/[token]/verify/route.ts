import { NextRequest, NextResponse } from "next/server";

import { getPublicDashboardDocumentVerificationData } from "@/lib/data/dashboard-documents-store";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const data = await getPublicDashboardDocumentVerificationData(token, request.nextUrl.origin);
    if (!data) {
      return NextResponse.json(
        { success: false, error: { message: "Shared verification page not found." } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[/api/public/documents/[token]/verify] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load shared verification." } },
      { status: 500 },
    );
  }
}
