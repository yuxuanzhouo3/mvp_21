import { NextRequest, NextResponse } from "next/server";

import {
  logAdminApiError,
  logAdminAudit,
  requireAdmin,
  type AdminAuditContext,
} from "@/lib/auth/admin-auth";
import { downloadFileFromCloudBase } from "@/lib/cloudbase/cloudbase-service";
import {
  deleteAdminUploadedFile,
  resolveDownloadContentType,
  uploadAdminFile,
} from "@/lib/data/admin-management-store";

export async function GET(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path") || "";
    const fileName = searchParams.get("name") || "download.bin";

    if (!filePath) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing file path",
        },
        { status: 400 },
      );
    }

    const buffer = await downloadFileFromCloudBase(filePath);
    logAdminAudit("Admin downloaded uploaded file", auditContext, {
      filePath,
      fileName,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": resolveDownloadContentType(fileName),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    logAdminApiError("Failed to download admin file", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to download file",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "app-releases";

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file selected",
        },
        { status: 400 },
      );
    }

    const uploaded = await uploadAdminFile(file, folder);
    logAdminAudit("Admin uploaded file", auditContext, {
      folder,
      fileName: file.name,
    });

    return NextResponse.json({
      success: true,
      data: uploaded,
    });
  } catch (error) {
    logAdminApiError("Failed to upload admin file", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  let auditContext: AdminAuditContext | undefined;

  try {
    const admin = await requireAdmin(request);
    if ("error" in admin) {
      return admin.error;
    }

    auditContext = admin.auditContext;
    const { path } = await request.json();

    if (!path) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing file path",
        },
        { status: 400 },
      );
    }

    await deleteAdminUploadedFile(path);
    logAdminAudit("Admin deleted uploaded file", auditContext, { path });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    logAdminApiError("Failed to delete admin file", error, auditContext);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete file",
      },
      { status: 500 },
    );
  }
}
