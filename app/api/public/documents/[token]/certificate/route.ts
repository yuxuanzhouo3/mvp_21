import { NextRequest, NextResponse } from "next/server";

import { buildPublicDashboardDocumentCertificate } from "@/lib/data/dashboard-documents-store";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const certificate = await buildPublicDashboardDocumentCertificate(token, request.nextUrl.origin);
    if (!certificate) {
      return NextResponse.json(
        { success: false, error: { message: "Shared verification page not found." } },
        { status: 404 },
      );
    }

    return new NextResponse(certificate.content, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${certificate.fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[/api/public/documents/[token]/certificate] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to build shared certificate." } },
      { status: 500 },
    );
  }
}
