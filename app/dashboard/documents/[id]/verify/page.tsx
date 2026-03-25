"use client";

import { useLanguage } from "@/components/language-provider";
import { DocumentVerification } from "@/components/documents/document-verification";
import { ConsoleShell } from "@/components/layout/console-shell";
import { useTranslations } from "@/lib/i18n";

export default function VerifyDocumentPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    documents: language === "en" ? "Documents" : "文档库",
  };

  const content = t.pages?.documentVerification || {
    title: language === "en" ? "Document Verification" : "文档验证",
    description:
      language === "en"
        ? "Review signature details, hash records, and blockchain proof."
        : "查看签署详情、哈希记录和区块链凭证。",
  };

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
      <DocumentVerification />
    </ConsoleShell>
  );
}
