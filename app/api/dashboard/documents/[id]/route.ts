import { NextRequest, NextResponse } from "next/server";

import { decodeDashboardDocumentId } from "@/lib/data/dashboard-documents-store";
import {
  deleteWorkspaceDocument,
  getWorkspaceDocumentById,
  updateWorkspaceDocument,
} from "@/lib/data/workspace-documents-store";
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
    const reference = decodeDashboardDocumentId(id);
    if (reference.sourceKind !== "uploaded") {
      return NextResponse.json(
        { success: false, error: { message: "Only uploaded documents can be edited here." } },
        { status: 400 },
      );
    }

    const document = await getWorkspaceDocumentById(reference.rawId);
    if (!document || document.userId !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      title?: string;
      category?: string;
      groupName?: string;
      tags?: string[];
    };

    const updated = await updateWorkspaceDocument(document, {
      title: body.title,
      category: body.category,
      groupName: body.groupName,
      tags: Array.isArray(body.tags)
        ? body.tags.filter((item): item is string => typeof item === "string")
        : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        document: updated,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]] Failed to update document:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update document." } },
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
    const reference = decodeDashboardDocumentId(id);
    if (reference.sourceKind !== "uploaded") {
      return NextResponse.json(
        { success: false, error: { message: "Only uploaded documents can be deleted here." } },
        { status: 400 },
      );
    }

    const document = await getWorkspaceDocumentById(reference.rawId);
    if (!document || document.userId !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Document not found." } },
        { status: 404 },
      );
    }

    await deleteWorkspaceDocument(document);

    return NextResponse.json({
      success: true,
      data: {
        id,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents/[id]] Failed to delete document:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete document." } },
      { status: 500 },
    );
  }
}
