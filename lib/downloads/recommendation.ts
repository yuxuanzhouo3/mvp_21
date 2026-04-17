import type { PlatformType } from "@/lib/config/download.config";

export interface DownloadVariantItem {
  platform: PlatformType;
  variant?: string | null;
}

function normalizeVariant(value?: string | null) {
  if (!value) return undefined;
  return value.trim().toLowerCase();
}

export function inferPreferredVariant(
  platform: PlatformType,
  userAgent?: string | null,
  platformHint?: string | null,
) {
  const signal = `${userAgent || ""} ${platformHint || ""}`.toLowerCase();

  if (platform === "macos") {
    if (/(apple silicon|arm64|aarch64|m1|m2|m3|m4)/.test(signal)) {
      return "m";
    }
    if (/intel|x86_64|x64/.test(signal)) {
      return "intel";
    }
    return undefined;
  }

  if (platform === "windows") {
    if (/(arm64|aarch64)/.test(signal)) {
      return "arm64";
    }
    if (/(win64|wow64|x64|amd64|x86_64)/.test(signal)) {
      return "x64";
    }
    if (/(i[3-6]86|x86)/.test(signal)) {
      return "x86";
    }
  }

  return undefined;
}

export function getVariantPreferenceOrder(
  platform: PlatformType,
  preferredVariant?: string | null,
) {
  const normalized = normalizeVariant(preferredVariant);

  if (platform === "windows") {
    if (normalized === "arm64") {
      return ["arm64", "x64", "x86"];
    }
    if (normalized === "x86") {
      return ["x86", "x64", "arm64"];
    }
    return ["x64", "x86", "arm64"];
  }

  if (platform === "macos") {
    if (normalized === "intel") {
      return ["intel", "m"];
    }
    if (normalized === "m") {
      return ["m", "intel"];
    }
    return ["m", "intel"];
  }

  return [];
}

export function pickRecommendedVariantItem<T extends DownloadVariantItem>(
  items: T[],
  platform: PlatformType | null,
  preferredVariant?: string | null,
): T | null {
  if (!platform) return null;

  const platformItems = items.filter((item) => item.platform === platform);
  if (platformItems.length === 0) return null;
  if (platformItems.length === 1) return platformItems[0];

  const order = getVariantPreferenceOrder(platform, preferredVariant);
  for (const candidate of order) {
    const matched = platformItems.find(
      (item) => normalizeVariant(item.variant) === candidate,
    );
    if (matched) {
      return matched;
    }
  }

  const generic = platformItems.find((item) => !normalizeVariant(item.variant));
  if (generic) {
    return generic;
  }

  return platformItems[0];
}
