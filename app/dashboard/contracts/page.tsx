"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ContractList } from "@/components/dashboard/contract-list";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export default function ContractsPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    contracts: language === "en" ? "Contracts" : "合同",
  };

  const content = t.pages?.contracts || {
    title: language === "en" ? "Contracts" : "合同管理",
    description:
      language === "en"
        ? "Manage all your contracts in one place."
        : "在一个页面统一管理所有合同。",
    primaryAction: language === "en" ? "New Contract" : "新建合同",
  };

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.contracts },
      ]}
      title={content.title}
      description={content.description}
      actions={
        <Button size="sm" asChild>
          <Link href="/dashboard/contracts/new">
            <Plus className="mr-2 h-4 w-4" />
            {content.primaryAction}
          </Link>
        </Button>
      }
    >
      <ContractList />
    </ConsoleShell>
  );
}
