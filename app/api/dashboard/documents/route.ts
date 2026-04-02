import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { createHash } from "node:crypto";

import { decodeDashboardDocumentId } from "@/lib/data/dashboard-documents-store";
import { getDashboardDocumentsData } from "@/lib/data/dashboard-documents-store";
import {
  createWorkspaceDocument,
  updateWorkspaceDocumentsOrganization,
  updateWorkspaceDocumentsTags,
} from "@/lib/data/workspace-documents-store";
import { requireDashboardUser } from "@/lib/dashboard/server-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const data = await getDashboardDocumentsData(auth.user.id, request.nextUrl.origin);
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[/api/dashboard/documents] Failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to load dashboard documents." } },
      { status: 500 },
    );
  }
}

function normalizeTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [] as string[];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function extractPreviewText(fileName: string, contentType: string, buffer: Buffer) {
  const lowerName = fileName.toLowerCase();
  const isTextLike =
    contentType.startsWith("text/") ||
    ["application/json", "application/xml", "text/markdown"].includes(contentType) ||
    [".txt", ".md", ".json", ".csv", ".xml", ".html"].some((ext) => lowerName.endsWith(ext));

  if (!isTextLike) {
    return undefined;
  }

  return buffer
    .toString("utf8")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: { message: "Please choose a file to upload." } },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { success: false, error: { message: "The selected file is empty." } },
        { status: 400 },
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: { message: "Please upload files smaller than 15 MB." } },
        { status: 400 },
      );
    }

    const titleField = formData.get("title");
    const categoryField = formData.get("category");
    const tagsField = formData.get("tags");
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "uploaded-document";
    const parsed = path.parse(fileName);
    const title =
      typeof titleField === "string" && titleField.trim()
        ? titleField.trim()
        : parsed.name || fileName;
    const category =
      typeof categoryField === "string" && categoryField.trim()
        ? categoryField.trim()
        : "General";
    const groupField = formData.get("groupName");
    const contentType = file.type || "application/octet-stream";
    const created = await createWorkspaceDocument({
      userId: auth.user.id,
      title,
      fileName,
      category,
      groupName: typeof groupField === "string" ? groupField.trim() || "Workspace" : "Workspace",
      tags: normalizeTags(tagsField),
      contentType,
      sizeBytes: file.size,
      hash: createHash("sha256").update(fileBuffer).digest("hex"),
      previewText: extractPreviewText(fileName, contentType, fileBuffer),
      fileContent: fileBuffer,
    });

    return NextResponse.json({
      success: true,
      data: {
        document: created,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents] Upload failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to upload document." } },
      { status: 500 },
    );
  }
}

function normalizeRequestedIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 100);
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ("error" in auth) {
      return auth.error;
    }

    const body = (await request.json()) as {
      action?: string;
      documentIds?: string[];
      tags?: string[];
      mode?: "add" | "replace" | "remove";
      category?: string;
      groupName?: string;
    };

    if (body.action !== "batch_tags" && body.action !== "batch_organize") {
      return NextResponse.json(
        { success: false, error: { message: "Unsupported batch action." } },
        { status: 400 },
      );
    }

    const requestedIds = normalizeRequestedIds(body.documentIds);
    const uploadedIds = requestedIds
      .map((id) => decodeDashboardDocumentId(id))
      .filter((item) => item.sourceKind === "uploaded")
      .map((item) => item.rawId);

    if (uploadedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Please choose uploaded documents first." } },
        { status: 400 },
      );
    }

    let documents;
    if (body.action === "batch_tags") {
      const mode = body.mode === "replace" || body.mode === "remove" ? body.mode : "add";
      const tags = Array.isArray(body.tags)
        ? body.tags.filter((item): item is string => typeof item === "string")
        : [];

      documents = await updateWorkspaceDocumentsTags({
        userId: auth.user.id,
        documentIds: uploadedIds,
        mode,
        tags,
      });
    } else {
      documents = await updateWorkspaceDocumentsOrganization({
        userId: auth.user.id,
        documentIds: uploadedIds,
        category: typeof body.category === "string" ? body.category : undefined,
        groupName: typeof body.groupName === "string" ? body.groupName : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        documents,
      },
    });
  } catch (error) {
    console.error("[/api/dashboard/documents] Batch tag update failed:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update document tags." } },
      { status: 500 },
    );
  }
}
