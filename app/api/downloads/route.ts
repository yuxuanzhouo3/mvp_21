import { NextRequest, NextResponse } from "next/server";

import { getDatabaseAdapter } from "@/lib/admin/database";
import type { AppRelease, Variant } from "@/lib/admin/types";
import { downloadFileFromCloudBase } from "@/lib/cloudbase/cloudbase-service";
import { getDownloadInfo, type MacOSArchitecture, type PlatformType } from "@/lib/config/download.config";
import { isChinaRegion } from "@/lib/config/region";
import { resolveDownloadContentType } from "@/lib/data/admin-management-store";
import {
  extractCloudBaseFileId,
  getPreferredFileName,
  getPublicDownloadCatalog,
} from "@/lib/downloads/public-downloads";
import { getVariantPreferenceOrder, inferPreferredVariant } from "@/lib/downloads/recommendation";

const VARIANT_SET: ReadonlySet<Variant> = new Set([
  "x64",
  "x86",
  "arm64",
  "intel",
  "m",
  "deb",
  "rpm",
  "appimage",
  "snap",
  "flatpak",
  "aur",
]);

const PLATFORM_VARIANTS: Record<PlatformType, Variant[]> = {
  ios: [],
  android: [],
  windows: ["x64", "x86", "arm64"],
  macos: ["intel", "m"],
  linux: ["deb", "rpm", "appimage", "snap", "flatpak", "aur"],
  harmonyos: [],
};

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

function getVariant(searchParams: URLSearchParams): Variant | null {
  const variant = searchParams.get("variant");
  if (!variant) {
    return null;
  }

  const normalized = variant.trim().toLowerCase();
  if (VARIANT_SET.has(normalized as Variant)) {
    return normalized as Variant;
  }

  if (normalized === "apple-silicon") {
    return "m";
  }

  return null;
}

function variantToArch(variant?: Variant | null): MacOSArchitecture | undefined {
  if (variant === "intel") {
    return "intel";
  }
  if (variant === "m") {
    return "apple-silicon";
  }
  return undefined;
}

function normalizeReleaseVariant(value?: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
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

function normalizeRequestedVariant(
  platform: PlatformType,
  variant: Variant | null,
  arch: MacOSArchitecture | undefined,
) {
  if (platform === "macos") {
    if (variant && variant !== "intel" && variant !== "m") {
      return { error: "Invalid variant for macOS." } as const;
    }

    if (arch && variant && variantToArch(variant) !== arch) {
      return { error: "variant and arch mismatch." } as const;
    }

    return { variant: variant || (arch === "intel" ? "intel" : arch === "apple-silicon" ? "m" : undefined) } as const;
  }

  if (arch) {
    return { error: "arch is only supported when platform=macos." } as const;
  }

  if (variant && !PLATFORM_VARIANTS[platform].includes(variant)) {
    return { error: "Invalid variant for this platform." } as const;
  }

  return { variant: variant || undefined } as const;
}

async function listManagedReleases(): Promise<AppRelease[]> {
  try {
    const adapter = getDatabaseAdapter();
    const releases = await adapter.listReleases();

    return releases
      .filter((release) => release.is_active)
      .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""));
  } catch (error) {
    console.error("[downloads] Failed to load managed releases, fallback to config:", error);
    return [];
  }
}

async function resolveManagedRelease(
  platform: PlatformType,
  variant?: Variant,
  userAgent?: string | null,
) {
  const releases = await listManagedReleases();
  const samePlatformReleases = releases.filter(
    (release) => mapAdminPlatform(release.platform) === platform,
  );

  if (samePlatformReleases.length === 0) {
    return undefined;
  }

  if (variant) {
    const requestedVariant = variant.toLowerCase();
    return samePlatformReleases.find(
      (release) => normalizeReleaseVariant(release.variant) === requestedVariant,
    );
  }

  const preferredVariant = inferPreferredVariant(platform, userAgent);
  const variantOrder = getVariantPreferenceOrder(platform, preferredVariant);
  for (const candidate of variantOrder) {
    const matched = samePlatformReleases.find(
      (release) => normalizeReleaseVariant(release.variant) === candidate,
    );
    if (matched) {
      return matched;
    }
  }

  const generic = samePlatformReleases.find(
    (release) => !normalizeReleaseVariant(release.variant),
  );
  if (generic) {
    return generic;
  }

  return samePlatformReleases[0];
}

async function streamCloudBaseFile(fileId: string, fileName: string) {
  const buffer = await downloadFileFromCloudBase(fileId);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": resolveDownloadContentType(fileName),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "public, max-age=60",
    },
  });
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

  const variant = getVariant(searchParams);
  if (searchParams.get("variant") && !variant) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid variant" },
      { status: 400 },
    );
  }

  const arch = getArch(searchParams);
  const normalized = normalizeRequestedVariant(platform, variant, arch);
  if ("error" in normalized) {
    return NextResponse.json(
      { success: false, error: normalized.error },
      { status: 400 },
    );
  }

  const managedRelease = await resolveManagedRelease(
    platform,
    normalized.variant,
    request.headers.get("user-agent"),
  );
  if (managedRelease) {
    const fileName = getPreferredFileName(
      managedRelease.file_url,
      platform,
      managedRelease.version,
    );

    if (isChinaRegion()) {
      const fileId = extractCloudBaseFileId(managedRelease.file_url) || managedRelease.file_url;
      if (!fileId) {
        return NextResponse.json(
          { success: false, error: "Managed download file is unavailable." },
          { status: 404 },
        );
      }
      return streamCloudBaseFile(fileId, fileName);
    }

    const targetUrl = managedRelease.file_url.startsWith("http")
      ? managedRelease.file_url
      : new URL(managedRelease.file_url, request.nextUrl.origin).toString();
    return NextResponse.redirect(targetUrl, { status: 302 });
  }

  if (normalized.variant && platform !== "macos") {
    return NextResponse.json(
      { success: false, error: "Requested variant is unavailable for this platform." },
      { status: 404 },
    );
  }

  const fallbackArch = platform === "macos" ? arch || variantToArch(normalized.variant) : undefined;
  const fallback = getDownloadInfo(platform, isChinaRegion(), fallbackArch);
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
      normalized.variant || undefined,
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
