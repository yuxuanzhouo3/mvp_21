"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ContractList } from "@/components/dashboard/contract-list";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { getDashboardOverview } from "@/lib/dashboard/client";
import type { DashboardOverviewData } from "@/lib/dashboard/types";
import { useTranslations } from "@/lib/i18n";

export default function DashboardPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const [overview, setOverview] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const labels = t.platform?.consoleModules || {
    overview: "Overview",
  };

  const content = t.pages?.dashboard || {
    title: "Dashboard",
    description:
      "Manage contracts, monitor signature progress, and track team activity.",
    updated: "Updated",
    newContract: "New Contract",
  };

  useEffect(() => {
    let cancelled = false;

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
  }, []);

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
      <DashboardStats stats={overview?.stats} loading={loading} />

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
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
