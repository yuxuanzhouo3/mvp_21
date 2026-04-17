import path from "path";

import { getDatabaseAdapter } from "@/lib/admin/database";
import type { AppRelease, Variant } from "@/lib/admin/types";
import {
  getDownloadConfig,
  type DownloadLink,
  type MacOSArchitecture,
  type PlatformType,
} from "@/lib/config/download.config";
import { isChinaRegion } from "@/lib/config/region";

export type PublicDownloadPlatform = PlatformType;

export interface PublicDownloadItem {
  platform: PublicDownloadPlatform;
  label: string;
  href: string;
  source: "managed" | "config";
  version?: string;
  buildNumber?: number;
  fileSize?: number;
  createdAt?: string;
  changelog?: string;
  arch?: MacOSArchitecture;
  variant?: Variant;
}

export interface PublicDownloadCatalog {
  region: "CN" | "INTL";
  downloads: PublicDownloadItem[];
  logs: Array<{
    id: string;
    text: string;
    date: string;
  }>;
}

const PLATFORM_ORDER: PublicDownloadPlatform[] = [
  "ios",
  "android",
  "windows",
  "macos",
  "linux",
  "harmonyos",
];

function mapAdminPlatform(platform: string): PublicDownloadPlatform | null {
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

function mapArchToVariant(arch?: MacOSArchitecture): Variant | undefined {
  if (arch === "intel") {
    return "intel";
  }
  if (arch === "apple-silicon") {
    return "m";
  }
  return undefined;
}

function getPlatformLabel(platform: PublicDownloadPlatform) {
  switch (platform) {
    case "android":
      return "Android";
    case "ios":
      return "iOS";
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "harmonyos":
      return "HarmonyOS";
    default:
      return platform;
  }
}

function getVariantLabel(variant?: Variant) {
  if (!variant) {
    return "";
  }

  switch (variant) {
    case "x64":
      return "x64";
    case "x86":
      return "x86";
    case "arm64":
      return "ARM64";
    case "intel":
      return "Intel";
    case "m":
      return "Apple Silicon";
    case "deb":
      return "DEB";
    case "rpm":
      return "RPM";
    case "appimage":
      return "AppImage";
    case "snap":
      return "Snap";
    case "flatpak":
      return "Flatpak";
    case "aur":
      return "AUR";
    default:
      return variant;
  }
}

function buildChannelKey(platform: string, variant?: string) {
  return `${platform}:${variant || ""}`;
}

function isPlaceholderValue(value?: string) {
  if (!value) {
    return true;
  }

  const normalized = value.toLowerCase();
  return (
    normalized.includes("your-bucket") ||
    normalized.includes("your-org") ||
    normalized.includes("placeholder") ||
    normalized.includes("id123456789") ||
    normalized === "#" ||
    normalized.includes("multigpt")
  );
}

function getManagedHref(platform: PublicDownloadPlatform, variant?: Variant) {
  const params = new URLSearchParams({
    platform,
  });

  if (variant) {
    params.set("variant", variant);
  }

  return `/api/downloads?${params.toString()}`;
}

function getConfigHref(download: DownloadLink) {
  const params = new URLSearchParams({
    platform: download.platform,
  });

  if (download.platform === "macos" && download.arch) {
    params.set("arch", download.arch);
  }

  return `/api/downloads?${params.toString()}`;
}

function formatManagedLabel(platform: PublicDownloadPlatform, variant?: Variant) {
  const platformLabel = getPlatformLabel(platform);
  const variantLabel = getVariantLabel(variant);
  return variantLabel ? `${platformLabel} (${variantLabel})` : platformLabel;
}

function toManagedDownload(release: AppRelease): PublicDownloadItem | null {
  const platform = mapAdminPlatform(release.platform);
  if (!platform || !release.is_active) {
    return null;
  }

  return {
    platform,
    variant: release.variant,
    label: formatManagedLabel(platform, release.variant),
    href: getManagedHref(platform, release.variant),
    source: "managed",
    version: release.version,
    fileSize: release.file_size,
    createdAt: release.created_at,
    changelog: release.release_notes,
  };
}

function toFallbackDownload(download: DownloadLink): PublicDownloadItem | null {
  if (download.url && isPlaceholderValue(download.url)) {
    return null;
  }

  if (download.fileID && isPlaceholderValue(download.fileID)) {
    return null;
  }

  if (!download.url && !download.fileID) {
    return null;
  }

  const variant = download.platform === "macos" ? mapArchToVariant(download.arch) : undefined;

  return {
    platform: download.platform,
    label: download.label || formatManagedLabel(download.platform, variant),
    href: getConfigHref(download),
    source: "config",
    arch: download.arch,
    variant,
  };
}

function buildLogText(release: AppRelease) {
  const firstLine = (release.release_notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (firstLine) {
    return firstLine;
  }

  const platform = mapAdminPlatform(release.platform);
  const platformLabel = platform ? formatManagedLabel(platform, release.variant) : "Release";
  return `${platformLabel} v${release.version}`;
}

function buildLogs(releases: AppRelease[]) {
  return releases
    .filter((release) => release.is_active && Boolean(mapAdminPlatform(release.platform)))
    .slice(0, 6)
    .map((release) => ({
      id: release.id,
      text: buildLogText(release),
      date: release.created_at ? new Date(release.created_at).toISOString().slice(0, 10) : "",
    }));
}

function sortByPlatform(left: PublicDownloadItem, right: PublicDownloadItem) {
  const leftIndex = PLATFORM_ORDER.indexOf(left.platform);
  const rightIndex = PLATFORM_ORDER.indexOf(right.platform);
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  return left.label.localeCompare(right.label);
}

function pickLatestManagedByChannel(releases: AppRelease[]) {
  const byChannel = new Map<string, AppRelease>();

  for (const release of releases) {
    const platform = mapAdminPlatform(release.platform);
    if (!platform || !release.is_active) {
      continue;
    }

    const channelKey = buildChannelKey(platform, release.variant);
    if (!byChannel.has(channelKey)) {
      byChannel.set(channelKey, release);
    }
  }

  return Array.from(byChannel.values());
}

async function listManagedReleases(): Promise<AppRelease[]> {
  try {
    const adapter = getDatabaseAdapter();
    const releases = await adapter.listReleases();

    return releases
      .filter((item) => item.is_active)
      .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""));
  } catch {
    return [];
  }
}

export function getPreferredFileName(fileUrl: string, platform: string, version?: string) {
  try {
    const parsed = new URL(fileUrl, "http://local");
    const explicitName = parsed.searchParams.get("name");
    if (explicitName) {
      return explicitName;
    }

    const filePath = parsed.pathname;
    const baseName = path.basename(filePath);
    if (baseName && baseName !== "/") {
      return baseName;
    }
  } catch {
    const baseName = path.basename(fileUrl);
    if (baseName && baseName !== "." && baseName !== "/") {
      return baseName;
    }
  }

  return `${platform}${version ? `-v${version}` : ""}.bin`;
}

export function extractCloudBaseFileId(fileUrl: string) {
  try {
    if (fileUrl.startsWith("cloud://")) {
      return fileUrl;
    }

    const parsed = new URL(fileUrl, "http://local");
    const pathParam = parsed.searchParams.get("path");
    if (pathParam) {
      return pathParam;
    }

    if (parsed.pathname.includes("/releases/")) {
      const pathName = parsed.pathname.split("/releases/").pop();
      if (pathName) {
        return `releases/${pathName}`;
      }
    }

    return "";
  } catch {
    return fileUrl.startsWith("cloud://") ? fileUrl : "";
  }
}

export async function getPublicDownloadCatalog(): Promise<PublicDownloadCatalog> {
  const isChina = isChinaRegion();
  const region = isChina ? "CN" : "INTL";
  const config = getDownloadConfig(isChina);
  const managedReleases = await listManagedReleases();
  const managedLatest = pickLatestManagedByChannel(managedReleases);

  const managedItems = managedLatest
    .map((release) => toManagedDownload(release))
    .filter((item): item is PublicDownloadItem => Boolean(item));

  const managedChannels = new Set(
    managedItems.map((item) => buildChannelKey(item.platform, item.variant)),
  );

  const fallbackItems = config.downloads
    .map((download) => toFallbackDownload(download))
    .filter((item): item is PublicDownloadItem => Boolean(item))
    .filter((item) => !managedChannels.has(buildChannelKey(item.platform, item.variant)));

  return {
    region,
    downloads: [...managedItems, ...fallbackItems].sort(sortByPlatform),
    logs: buildLogs(managedReleases),
  };
}
