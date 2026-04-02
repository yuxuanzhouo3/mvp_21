"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { DocumentVerification } from "@/components/documents/document-verification";
import { ConsoleShell } from "@/components/layout/console-shell";
import { getDashboardDocumentVerification } from "@/lib/dashboard/client";
import type { DashboardDocumentVerificationData } from "@/lib/dashboard/types";
import { useTranslations } from "@/lib/i18n";

export default function VerifyDocumentPage() {
  const params = useParams<{ id: string }>();
  const documentId = typeof params?.id === "string" ? params.id : "";
  const { language } = useLanguage();
  const t = useTranslations(language);
  const isEn = language === "en";
  const [data, setData] = useState<DashboardDocumentVerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    documents: language === "en" ? "Documents" : "文档",
  };

  const content = t.pages?.documentVerification || {
    title: language === "en" ? "Document Verification" : "文档验真",
    description:
      language === "en"
        ? "Review signature details, hash snapshots, and workflow evidence."
        : "查看签署详情、哈希快照与真实流程证据。",
  };

  useEffect(() => {
    let cancelled = false;

    async function loadVerification() {
      if (!documentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadFailed(false);
        const nextData = await getDashboardDocumentVerification(documentId);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (error) {
        console.error("[VerifyDocumentPage] Failed to load verification:", error);
        if (!cancelled) {
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVerification();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.documents, href: "/dashboard/documents" },
        { label: content.title },
      ]}
      title={content.title}
      description={content.description}
    >
      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-border/70 bg-card/80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEn ? "Loading verification data..." : "正在加载验真数据..."}
          </div>
        </div>
      ) : loadFailed || !data ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-border/70 bg-card/80 p-6 text-center text-sm text-muted-foreground">
          {isEn ? "Failed to load the verification record." : "加载验真记录失败。"}
        </div>
      ) : (
        <DocumentVerification data={data} />
      )}
    </ConsoleShell>
  );
}
