import { NextRequest, NextResponse } from "next/server";

import { downloadFileFromCloudBase } from "@/lib/cloudbase/cloudbase-service";
import { getDownloadInfo, type MacOSArchitecture, type PlatformType } from "@/lib/config/download.config";
import { isChinaRegion } from "@/lib/config/region";
import { resolveDownloadContentType, listAdminVersions } from "@/lib/data/admin-management-store";
import {
  extractCloudBaseFileId,
  getPreferredFileName,
  getPublicDownloadCatalog,
} from "@/lib/downloads/public-downloads";

function mapAdminPlatform(platform: string): PlatformType | null {
  switch (platform) {
    case "android":
    case "ios":
    case "windows":
    case "linux":
    case "harmonyos":
      return platform;
    case "mac":
    case "macos":
      return "macos";
    default:
      return null;
  }
}

async function resolveManagedVersion(platform: PlatformType) {
  const versions = await listAdminVersions();
  return versions
    .filter((item) => item.isActive && mapAdminPlatform(item.platform) === platform)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

async function streamCloudBaseFile(fileId: string, fileName: string) {
  const buffer = await downloadFileFromCloudBase(fileId);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": resolveDownloadContentType(fileName),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}

function getPlatform(searchParams: URLSearchParams) {
  const platform = searchParams.get("platform");
  if (
    platform !== "android" &&
    platform !== "ios" &&
    platform !== "windows" &&
    platform !== "macos" &&
    platform !== "linux" &&
    platform !== "harmonyos"
  ) {
    return null;
  }

  return platform;
}

function getArch(searchParams: URLSearchParams): MacOSArchitecture | undefined {
  const arch = searchParams.get("arch");
  return arch === "intel" || arch === "apple-silicon" ? arch : undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("catalog") === "1" || searchParams.get("format") === "json") {
    return NextResponse.json(await getPublicDownloadCatalog());
  }

  const platform = getPlatform(searchParams);
  if (!platform) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid platform" },
      { status: 400 },
    );
  }

  const arch = getArch(searchParams);
  const managedVersion = await resolveManagedVersion(platform);

  if (managedVersion) {
    const fileName = getPreferredFileName(managedVersion.fileUrl, platform, managedVersion.version);

    if (isChinaRegion()) {
      const fileId = extractCloudBaseFileId(managedVersion.fileUrl) || managedVersion.fileUrl;
      if (!fileId) {
        return NextResponse.json(
          { success: false, error: "Managed download file is unavailable." },
          { status: 404 },
        );
      }
      return streamCloudBaseFile(fileId, fileName);
    }

    const targetUrl = managedVersion.fileUrl.startsWith("http")
      ? managedVersion.fileUrl
      : new URL(managedVersion.fileUrl, request.nextUrl.origin).toString();
    return NextResponse.redirect(targetUrl, { status: 302 });
  }

  const fallback = getDownloadInfo(platform, isChinaRegion(), arch);
  if (!fallback) {
    return NextResponse.json(
      { success: false, error: "Download is not available for this platform." },
      { status: 404 },
    );
  }

  if (isChinaRegion()) {
    if (!fallback.fileID) {
      return NextResponse.json(
        { success: false, error: "Download file is not configured." },
        { status: 404 },
      );
    }

    const fileName = getPreferredFileName(
      fallback.fileID,
      platform,
      arch ? `${platform}-${arch}` : platform,
    );
    return streamCloudBaseFile(fallback.fileID, fileName);
  }

  if (!fallback.url) {
    return NextResponse.json(
      { success: false, error: "Download URL is not configured." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(fallback.url, { status: 302 });
}
