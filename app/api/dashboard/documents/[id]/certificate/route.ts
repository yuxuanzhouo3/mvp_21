import { NextRequest, NextResponse } from "next/server";

import { buildDashboardDocumentCertificate } from "@/lib/data/dashboard-documents-store";
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
    const certificate = await buildDashboardDocumentCertificate(
      auth.user.id,
      id,
      request.nextUrl.origin,
    );
    if (!certificate) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    return new NextResponse(certificate.content, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${certificate.fileName}"`,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]/certificate] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to build certificate." } },
      { status: 500 },
    );
  }
}
