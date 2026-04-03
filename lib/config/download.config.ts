export type PlatformType =
  | "android"
  | "ios"
  | "windows"
  | "macos"
  | "linux"
  | "harmonyos";

export type MacOSArchitecture = "intel" | "apple-silicon";

export interface DownloadLink {
  platform: PlatformType;
  label: string;
  url?: string;
  fileID?: string;
  arch?: MacOSArchitecture;
}

export interface RegionDownloadConfig {
  region: "CN" | "INTL";
  downloads: DownloadLink[];
}

const chinaDownloads: RegionDownloadConfig = {
  region: "CN",
  downloads: [
    {
      platform: "android",
      label: "Android",
      fileID: process.env.CN_ANDROID_FILE_ID,
    },
    {
      platform: "ios",
      label: "iOS",
      fileID: process.env.CN_IOS_FILE_ID,
    },
    {
      platform: "windows",
      label: "Windows",
      fileID: process.env.CN_WINDOWS_FILE_ID,
    },
    {
      platform: "macos",
      label: "macOS (Intel)",
      arch: "intel",
      fileID: process.env.CN_MACOS_INTEL_FILE_ID,
    },
    {
      platform: "macos",
      label: "macOS (Apple Silicon)",
      arch: "apple-silicon",
      fileID: process.env.CN_MACOS_APPLE_SILICON_FILE_ID,
    },
    {
      platform: "harmonyos",
      label: "HarmonyOS",
      fileID: process.env.CN_HARMONYOS_FILE_ID,
    },
  ],
};

const internationalDownloads: RegionDownloadConfig = {
  region: "INTL",
  downloads: [
    {
      platform: "android",
      label: "Android",
      url: process.env.INTL_ANDROID_URL,
    },
    {
      platform: "ios",
      label: "iOS",
      url: process.env.INTL_IOS_URL,
    },
    {
      platform: "windows",
      label: "Windows",
      url: process.env.INTL_WINDOWS_URL,
    },
    {
      platform: "macos",
      label: "macOS (Intel)",
      arch: "intel",
      url: process.env.INTL_MACOS_INTEL_URL,
    },
    {
      platform: "macos",
      label: "macOS (Apple Silicon)",
      arch: "apple-silicon",
      url: process.env.INTL_MACOS_APPLE_SILICON_URL,
    },
    {
      platform: "linux",
      label: "Linux",
      url: process.env.INTL_LINUX_URL,
    },
    {
      platform: "harmonyos",
      label: "HarmonyOS",
      url: process.env.INTL_HARMONYOS_URL,
    },
  ],
};

export function getDownloadConfig(isChina: boolean): RegionDownloadConfig {
  return isChina ? chinaDownloads : internationalDownloads;
}

export function getDownloadUrl(
  platform: PlatformType,
  isChina: boolean,
  arch?: MacOSArchitecture,
): string | null {
  const download = getDownloadInfo(platform, isChina, arch);
  if (!download) {
    return null;
  }

  return isChina ? download.fileID || null : download.url || null;
}

export function getDownloadInfo(
  platform: PlatformType,
  isChina: boolean,
  arch?: MacOSArchitecture,
): DownloadLink | null {
  const config = getDownloadConfig(isChina);

  if (platform === "macos" && arch) {
    return config.downloads.find((item) => item.platform === platform && item.arch === arch) || null;
  }

  return config.downloads.find((item) => item.platform === platform) || null;
}

export function detectUserPlatform(): PlatformType | null {
  if (typeof window === "undefined") {
    return null;
  }

  const ua = navigator.userAgent.toLowerCase();

  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";

  return null;
}

export function getDownloadsByPlatform(
  platform: PlatformType,
  isChina: boolean,
): DownloadLink[] {
  return getDownloadConfig(isChina).downloads.filter((item) => item.platform === platform);
}

export function getRecommendedDownload(isChina: boolean): DownloadLink | null {
  const platform = detectUserPlatform();
  if (!platform) {
    return null;
  }

  return getDownloadInfo(platform, isChina);
}
