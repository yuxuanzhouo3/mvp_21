"use client";

import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ContractList } from "@/components/dashboard/contract-list";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export default function DashboardPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
  };

  const content = t.pages?.dashboard || {
    title: language === "en" ? "Dashboard" : "控制台总览",
    description:
      language === "en"
        ? "Manage contracts, monitor signature progress, and track team activity."
        : "集中管理合同、跟踪签署进度并查看团队动态。",
    updated: language === "en" ? "Updated" : "更新于",
    newContract: language === "en" ? "New Contract" : "新建合同",
  };

  const lastUpdated = new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <ConsoleShell
      crumbs={[{ label: labels.overview }]}
      title={content.title}
      description={content.description}
      actions={
        <>
          <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {content.updated} {lastUpdated}
          </div>
          <Button asChild>
            <Link href="/dashboard/contracts/new">
              <Plus className="mr-2 h-4 w-4" />
              {content.newContract}
            </Link>
          </Button>
        </>
      }
    >
      <DashboardStats />

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ContractList />
        </div>
        <div>
          <RecentActivity />
        </div>
      </section>
    </ConsoleShell>
  );
}
