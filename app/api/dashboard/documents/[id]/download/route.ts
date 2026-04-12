import { NextRequest, NextResponse } from "next/server";

import { buildDashboardDocumentDownload } from "@/lib/data/dashboard-documents-store";
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
    const requestedFormat = request.nextUrl.searchParams.get("format");
    const format =
      requestedFormat === "pdf" || requestedFormat === "word" || requestedFormat === "html"
        ? requestedFormat
        : undefined;
    const file = await buildDashboardDocumentDownload(auth.user.id, id, { format });
    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "content-type": file.contentType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]/download] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to download document." } },
      { status: 500 },
    );
  }
}
