"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { DocumentLibrary } from "@/components/documents/document-library";
import { StorageStats } from "@/components/documents/storage-stats";
import { getDashboardDocuments } from "@/lib/dashboard/client";
import type { DashboardDocumentsData } from "@/lib/dashboard/types";
import { useTranslations } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const isEn = language === "en";
  const [data, setData] = useState<DashboardDocumentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    documents: language === "en" ? "Documents" : "文档",
  };

  const content = t.pages?.documents || {
    title: language === "en" ? "Document Storage" : "文档中心",
    description:
      language === "en"
        ? "Securely store, verify, and manage all your contract documents."
        : "安全管理、验真并查看所有真实合同文档。",
    primaryAction: language === "en" ? "View Verification" : "查看验真记录",
  };

  async function loadDocuments() {
    try {
      setLoading(true);
      setLoadFailed(false);
      const nextData = await getDashboardDocuments();
      setData(nextData);
    } catch (error) {
      console.error("[DocumentsPage] Failed to load documents:", error);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  const firstDocument = useMemo(() => data?.documents[0] || null, [data?.documents]);

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.documents },
      ]}
      title={content.title}
      description={content.description}
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link href={firstDocument ? `/dashboard/documents/${firstDocument.id}/verify` : "/dashboard/documents"}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {content.primaryAction}
          </Link>
        </Button>
      }
    >
      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-border/70 bg-card/80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEn ? "Loading document assets..." : "正在加载真实文档资产..."}
          </div>
        </div>
      ) : loadFailed || !data ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-border/70 bg-card/80 p-6 text-center text-sm text-muted-foreground">
          {isEn ? "Failed to load document assets. Please refresh and try again." : "加载真实文档资产失败，请刷新后重试。"}
        </div>
      ) : (
        <>
          <StorageStats stats={data.stats} />
          <div className="mt-8">
            <DocumentLibrary documents={data.documents} onDocumentsChanged={loadDocuments} />
          </div>
        </>
      )}
    </ConsoleShell>
  );
}
