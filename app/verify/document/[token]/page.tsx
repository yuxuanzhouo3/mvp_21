"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { DocumentVerification } from "@/components/documents/document-verification";
import { Button } from "@/components/ui/button";
import { getPublicDashboardDocumentVerification } from "@/lib/dashboard/client";
import type { DashboardDocumentVerificationData } from "@/lib/dashboard/types";

export default function PublicDocumentVerificationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const { language } = useLanguage();
  const isEn = language === "en";
  const [data, setData] = useState<DashboardDocumentVerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadVerification() {
      if (!token) {
        setLoading(false);
        setLoadFailed(true);
        return;
      }

      try {
        setLoading(true);
        setLoadFailed(false);
        const nextData = await getPublicDashboardDocumentVerification(token);
        if (!cancelled) {
          setData(nextData);
        }
      } catch (error) {
        console.error("[PublicDocumentVerificationPage] Failed to load verification:", error);
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
  }, [token]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto mb-8 flex max-w-5xl items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/95 p-6 shadow-sm">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">
              {isEn ? "Public Verification Portal" : "公开验真入口"}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {isEn ? "Document Verification Certificate" : "文档验真证书页"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEn
              ? "Review the shared verification result, document hash, and retained evidence."
              : "查看共享的验真结果、文档哈希和留存证据。"}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">{isEn ? "Back to Home" : "返回首页"}</Link>
        </Button>
      </div>

      {loading ? (
        <div className="mx-auto flex min-h-[260px] max-w-5xl items-center justify-center rounded-xl border border-border/70 bg-card/80">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEn ? "Loading verification data..." : "正在加载验真数据..."}
          </div>
        </div>
      ) : loadFailed || !data ? (
        <div className="mx-auto flex min-h-[260px] max-w-5xl items-center justify-center rounded-xl border border-border/70 bg-card/80 p-6 text-center text-sm text-muted-foreground">
          {isEn
            ? "This shared verification link is unavailable or has expired."
            : "这个分享验真链接暂不可用或已失效。"}
        </div>
      ) : (
        <DocumentVerification data={data} publicMode shareToken={token} />
      )}
    </main>
  );
}
