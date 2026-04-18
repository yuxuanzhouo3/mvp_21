"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ContractList } from "@/components/dashboard/contract-list";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ConsoleShell } from "@/components/layout/console-shell";
import { useUser } from "@/components/user-context";
import { Button } from "@/components/ui/button";
import { getDashboardOverview } from "@/lib/dashboard/client";
import type { DashboardOverviewData } from "@/lib/dashboard/types";
import { useTranslations } from "@/lib/i18n";

export default function DashboardPage() {
  const { language } = useLanguage();
  const { user, loading: userLoading } = useUser();
  const t = useTranslations(language);
  const isEn = language === "en";
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const labels = t.platform?.consoleModules || {
    overview: isEn ? "Overview" : "总览",
  };

  const content = t.pages?.dashboard || {
    title: isEn ? "Dashboard" : "控制台",
    description: isEn
      ? "Manage contracts, monitor signature progress, and track team activity."
      : "管理合同、跟踪签署进度，并查看团队活动。",
    updated: isEn ? "Updated" : "更新于",
    newContract: isEn ? "New Contract" : "新建合同",
  };

  useEffect(() => {
    let cancelled = false;

    if (userLoading) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    if (!user) {
      setOverview(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadOverview() {
      try {
        setLoading(true);
        const data = await getDashboardOverview();
        if (!cancelled) {
          setOverview(data);
        }
      } catch (error) {
        console.error("[DashboardPage] Failed to load overview:", error);
        if (!cancelled) {
          setOverview(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [user, userLoading]);

  const lastUpdated = new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(
    overview?.stats?.lastUpdated ? new Date(overview.stats.lastUpdated) : new Date(),
  );

  return (
    <ConsoleShell
      crumbs={[{ label: labels.overview }]}
      title={content.title}
      description={content.description}
      actions={
        <>
          <div className="inline-flex items-center justify-center gap-1 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground sm:justify-start">
            <CalendarClock className="h-3.5 w-3.5" />
            {content.updated} {lastUpdated}
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/contracts/new">
              <Plus className="mr-2 h-4 w-4" />
              {content.newContract}
            </Link>
          </Button>
        </>
      }
    >
      <DashboardStats stats={overview?.stats} loading={loading} />

      <section className="mt-6 grid gap-6 xl:mt-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ContractList />
        </div>
        <div>
          <RecentActivity
            activities={overview?.recentActivity || []}
            loading={loading}
          />
        </div>
      </section>
    </ConsoleShell>
  );
}
