"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Apple, ArrowLeft, ChevronRight, Download, Laptop, Monitor, Smartphone } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { detectUserPlatform, type PlatformType } from "@/lib/config/download.config";
import { isChinaRegion } from "@/lib/config/region";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils/utils";

type DownloadItem = {
  platform: PlatformType;
  label: string;
  href: string;
  version?: string;
  fileSize?: number;
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

export default function DownloadPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);
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
            {t.common.back}
          </Button>
        </Link>
      </div>

      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-12 text-center duration-700 animate-in fade-in slide-in-from-top-4 md:mb-20">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] bg-blue-50 shadow-sm">
            <Download className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {t.download.title}
          </h1>
          <p className="mt-3 text-sm text-slate-500 md:text-base">
            {isChinaRegion() ? t.download.chinaDescription : t.download.intlDescription}
          </p>
        </div>

        <div className="mb-16 w-full max-w-xl md:mb-24">
          <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

          {catalog.logs.length > 0 ? (
            <div className="space-y-3 text-sm text-slate-500 md:text-base">
              {catalog.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-4">
                  <span className="font-medium text-slate-700">{log.text}</span>
                  <span className="rounded bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-400 opacity-60 md:text-sm">
                    {log.date}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 text-sm text-slate-500">
              {language === "zh"
                ? "当前暂无公开更新日志，发布新版本后会自动同步到这里。"
                : "No public release notes yet. New active versions will appear here automatically."}
            </div>
          )}
        </div>

        {loading ? (
          <div className="pb-10 text-sm text-slate-500">
            {language === "zh" ? "正在加载下载目录..." : "Loading downloads..."}
          </div>
        ) : catalog.downloads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-8 py-10 text-center text-sm text-slate-500">
            {language === "zh"
              ? "当前环境还没有可公开下载的安装包。"
              : "No public installers are available in this environment yet."}
          </div>
        ) : (
          <div className="flex w-full flex-wrap justify-center gap-8 pb-10 md:gap-16">
            {catalog.downloads.map((download) => {
              const isCurrent = userPlatform === download.platform;

              return (
                <a
                  key={`${download.platform}-${download.label}`}
                  href={download.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center gap-4 transition-all duration-300 hover:-translate-y-2"
                >
                  <div
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all duration-300 md:h-[72px] md:w-[72px]",
                      "group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:shadow-lg group-hover:shadow-blue-500/10",
                      isCurrent && "border-blue-200 bg-blue-50 text-blue-600 ring-2 ring-blue-500 ring-offset-2 ring-offset-white",
                    )}
                  >
                    {getPlatformIcon(
                      download.platform,
                      "h-8 w-8 transition-transform duration-300 group-hover:scale-110 md:h-9 md:w-9",
                    )}
                  </div>

                  <div className="text-center">
                    <span
                      className={cn(
                        "block text-sm font-medium tracking-wide text-slate-500 transition-colors group-hover:text-blue-600",
                        isCurrent && "font-semibold text-blue-600",
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

        {catalog.downloads.length > 0 ? (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span>
              {language === "zh"
                ? "下载入口已自动连接当前启用版本"
                : "Download entries are linked to the latest active releases"}
            </span>
            <ChevronRight className="h-3 w-3" />
          </div>
        ) : null}
      </div>

      <footer className="absolute bottom-4 text-[10px] text-slate-300">
        Copyright © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
