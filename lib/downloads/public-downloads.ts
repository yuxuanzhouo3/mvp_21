import path from "path";

import { listAdminVersions, type AdminManagedVersion } from "@/lib/data/admin-management-store";
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

function getManagedHref(platform: PublicDownloadPlatform) {
  const params = new URLSearchParams({
    platform,
  });
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

function toManagedDownload(version: AdminManagedVersion): PublicDownloadItem | null {
  const platform = mapAdminPlatform(version.platform);
  if (!platform || !version.isActive) {
    return null;
  }

  return {
    platform,
    label: getPlatformLabel(platform),
    href: getManagedHref(platform),
    source: "managed",
    version: version.version,
    buildNumber: version.buildNumber,
    fileSize: version.fileSize,
    createdAt: version.createdAt,
    changelog: version.changelog,
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

  return {
    platform: download.platform,
    label: download.label || getPlatformLabel(download.platform),
    href: getConfigHref(download),
    source: "config",
    arch: download.arch,
  };
}

function buildLogText(version: AdminManagedVersion) {
  const firstLine = version.changelog
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine || `${getPlatformLabel(mapAdminPlatform(version.platform) || "windows")} v${version.version}`;
}

function buildLogs(versions: AdminManagedVersion[]) {
  return versions
    .filter((version) => version.isActive && Boolean(mapAdminPlatform(version.platform)))
    .slice(0, 6)
    .map((version) => ({
      id: version.id,
      text: buildLogText(version),
      date: version.createdAt ? new Date(version.createdAt).toISOString().slice(0, 10) : "",
    }));
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
    const parsed = new URL(fileUrl, "http://local");
    return parsed.searchParams.get("path") || "";
  } catch {
    return "";
  }
}

export async function getPublicDownloadCatalog(): Promise<PublicDownloadCatalog> {
  const isChina = isChinaRegion();
  const region = isChina ? "CN" : "INTL";
  const config = getDownloadConfig(isChina);
  const versions = (await listAdminVersions())
    .filter((item) => item.isActive)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const managedItems = versions
    .map((version) => toManagedDownload(version))
    .filter((item): item is PublicDownloadItem => Boolean(item));

  const managedPlatforms = new Set(managedItems.map((item) => item.platform));
  const fallbackItems = config.downloads
    .filter((download) => !managedPlatforms.has(download.platform))
    .map((download) => toFallbackDownload(download))
    .filter((item): item is PublicDownloadItem => Boolean(item));

  return {
    region,
    downloads: [...managedItems, ...fallbackItems],
    logs: buildLogs(versions),
  };
}
