"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { DocumentLibrary } from "@/components/documents/document-library";
import { StorageStats } from "@/components/documents/storage-stats";
import { useTranslations } from "@/lib/i18n";

export default function DocumentsPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    documents: language === "en" ? "Documents" : "文档库",
  };

  const content = t.pages?.documents || {
    title: language === "en" ? "Document Storage" : "文档库",
    description:
      language === "en"
        ? "Securely store, verify, and manage all your contract documents."
        : "安全存储、校验并管理所有合同文档。",
    primaryAction: language === "en" ? "View Verification" : "查看验证记录",
  };

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
          <Link href="/dashboard/documents/1/verify">
            <ShieldCheck className="mr-2 h-4 w-4" />
            {content.primaryAction}
          </Link>
        </Button>
      }
    >
      <StorageStats />
      <div className="mt-8">
        <DocumentLibrary />
      </div>
    </ConsoleShell>
  );
}
