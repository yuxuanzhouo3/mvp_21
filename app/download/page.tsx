"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Apple, ArrowLeft, ChevronRight, Download, Laptop, Monitor, Smartphone } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { detectUserPlatform, type PlatformType } from "@/lib/config/download.config";
import { inferPreferredVariant, pickRecommendedVariantItem } from "@/lib/downloads/recommendation";
import { cn } from "@/lib/utils/utils";

type DownloadItem = {
  platform: PlatformType;
  label: string;
  href: string;
  version?: string;
  fileSize?: number;
  variant?: string;
};

type DownloadLog = {
  id: string;
  text: string;
  date: string;
};

type DownloadCatalog = {
  downloads: DownloadItem[];
  logs: DownloadLog[];
};

function formatFileSize(fileSize?: number) {
  if (!fileSize) {
    return "";
  }

  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }

  if (fileSize < 1024 * 1024 * 1024) {
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatLogDate(value: string, language: "zh" | "en") {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getCopy(language: "zh" | "en") {
  if (language === "zh") {
    return {
      back: "返回",
      title: "下载中心",
      subtitle: "根据你的设备选择安装包，支持 iOS、Android、Windows、macOS、Linux 多平台发布。",
      logsTitle: "更新日志",
      noLogs: "暂无公开更新日志，发布新版本后会自动同步到这里。",
      loading: "正在加载下载目录...",
      empty: "当前环境还没有可公开下载的安装包。",
      recommended: "推荐",
      recommendAction: "下载当前平台",
      linkedTip: "下载入口已自动关联到当前启用版本",
    };
  }

  return {
    back: "Back",
    title: "Download Center",
    subtitle: "Choose the installer for your device. Supports iOS, Android, Windows, macOS and Linux.",
    logsTitle: "Release Notes",
    noLogs: "No public release notes yet. New active versions will appear here automatically.",
    loading: "Loading downloads...",
    empty: "No public installers are available in this environment yet.",
    recommended: "Recommended",
    recommendAction: "Download For This Device",
    linkedTip: "Download entries are linked to the latest active releases",
  };
}

export default function DownloadPage() {
  const { language } = useLanguage();
  const copy = getCopy(language);

  const [userPlatform, setUserPlatform] = useState<PlatformType | null>(null);
  const [catalog, setCatalog] = useState<DownloadCatalog>({ downloads: [], logs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUserPlatform(detectUserPlatform());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        setLoading(true);
        const response = await fetch("/api/downloads?catalog=1", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed to load download catalog: ${response.status}`);
        }

        const nextCatalog = (await response.json()) as DownloadCatalog;
        if (!cancelled) {
          setCatalog({
            downloads: Array.isArray(nextCatalog.downloads) ? nextCatalog.downloads : [],
            logs: Array.isArray(nextCatalog.logs) ? nextCatalog.logs : [],
          });
        }
      } catch (error) {
        console.error("[DownloadPage] Failed to load catalog:", error);
        if (!cancelled) {
          setCatalog({ downloads: [], logs: [] });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedDownloads = useMemo(() => {
    if (!userPlatform) {
      return catalog.downloads;
    }

    return [...catalog.downloads].sort((left, right) => {
      const leftScore = left.platform === userPlatform ? 0 : 1;
      const rightScore = right.platform === userPlatform ? 0 : 1;
      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }
      return left.label.localeCompare(right.label);
    });
  }, [catalog.downloads, userPlatform]);

  const recommendedDownload = useMemo(() => {
    if (!userPlatform || typeof window === "undefined") {
      return pickRecommendedVariantItem(sortedDownloads, userPlatform);
    }

    const preferredVariant = inferPreferredVariant(
      userPlatform,
      window.navigator.userAgent,
      window.navigator.platform,
    );

    return pickRecommendedVariantItem(sortedDownloads, userPlatform, preferredVariant);
  }, [sortedDownloads, userPlatform]);

  const getPlatformIcon = (platform: PlatformType, className = "h-6 w-6") => {
    switch (platform) {
      case "android":
      case "ios":
      case "harmonyos":
        return <Smartphone className={className} />;
      case "macos":
        return <Apple className={className} />;
      case "windows":
        return <Monitor className={className} />;
      case "linux":
        return <Laptop className={className} />;
      default:
        return <Download className={className} />;
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-white font-sans text-slate-900 selection:bg-blue-100">
      <div className="absolute left-6 top-6 z-20">
        <Link href="/">
          <Button
            variant="ghost"
            className="text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft className="mr-1 h-5 w-5" />
            {copy.back}
          </Button>
        </Link>
      </div>

      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-10 text-center duration-700 animate-in fade-in slide-in-from-top-4 md:mb-14">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] bg-blue-50 shadow-sm">
            <Download className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{copy.title}</h1>
          <p className="mt-3 text-sm text-slate-500 md:text-base">{copy.subtitle}</p>

          {recommendedDownload ? (
            <div className="mt-6">
              <a href={recommendedDownload.href} target="_blank" rel="noopener noreferrer">
                <Button className="gap-2 rounded-full bg-blue-600 px-5 hover:bg-blue-700">
                  <Download className="h-4 w-4" />
                  {copy.recommendAction}
                  <span className="rounded bg-white/20 px-2 py-0.5 text-[11px]">
                    {recommendedDownload.label}
                  </span>
                </Button>
              </a>
            </div>
          ) : null}
        </div>

        <div className="mb-14 w-full max-w-xl">
          <div className="mb-3 text-sm font-semibold text-slate-700">{copy.logsTitle}</div>
          <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          {catalog.logs.length > 0 ? (
            <div className="space-y-3 text-sm text-slate-500 md:text-base">
              {catalog.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">
                  <span className="font-medium text-slate-700">{log.text}</span>
                  <span className="rounded bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-400">
                    {formatLogDate(log.date, language)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 text-sm text-slate-500">{copy.noLogs}</div>
          )}
        </div>

        {loading ? (
          <div className="pb-10 text-sm text-slate-500">{copy.loading}</div>
        ) : sortedDownloads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-8 py-10 text-center text-sm text-slate-500">
            {copy.empty}
          </div>
        ) : (
          <div className="flex w-full flex-wrap justify-center gap-8 pb-10 md:gap-12">
            {sortedDownloads.map((download) => {
              const isRecommended = recommendedDownload === download;

              return (
                <a
                  key={`${download.platform}-${download.label}`}
                  href={download.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex w-[152px] flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
                >
                  {isRecommended ? (
                    <span className="absolute right-3 top-3 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                      {copy.recommended}
                    </span>
                  ) : null}

                  <div
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all duration-300",
                      "group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600",
                      isRecommended && "border-blue-200 bg-blue-50 text-blue-600 ring-2 ring-blue-500/20",
                    )}
                  >
                    {getPlatformIcon(download.platform, "h-7 w-7")}
                  </div>

                  <div className="text-center">
                    <span
                      className={cn(
                        "block text-sm font-medium tracking-wide text-slate-600 transition-colors group-hover:text-blue-600",
                        isRecommended && "font-semibold text-blue-600",
                      )}
                    >
                      {download.label}
                    </span>
                    {download.version ? (
                      <span className="mt-1 block text-xs text-slate-400">
                        v{download.version}
                        {download.fileSize ? ` · ${formatFileSize(download.fileSize)}` : ""}
                      </span>
                    ) : null}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {sortedDownloads.length > 0 ? (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>{copy.linkedTip}</span>
            <ChevronRight className="h-3 w-3" />
          </div>
        ) : null}
      </div>

      <footer className="absolute bottom-4 text-[10px] text-slate-300">Copyright © {new Date().getFullYear()}</footer>
    </div>
  );
}
