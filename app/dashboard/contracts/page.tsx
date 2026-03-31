"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ContractList } from "@/components/dashboard/contract-list";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";

export default function ContractsPage() {
  const { language } = useLanguage();
  const isEn = language === "en";

  const labels = {
    overview: isEn ? "Overview" : "总览",
    contracts: isEn ? "Contracts" : "合同",
  };

  const content = {
    title: isEn ? "Contracts" : "合同管理",
    description: isEn ? "Manage all your contracts in one place." : "在一个页面中统一管理所有合同。",
    primaryAction: isEn ? "New Contract" : "新建合同",
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
