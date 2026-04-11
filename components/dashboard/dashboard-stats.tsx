"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Users,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardOverviewStats as DashboardOverviewStatsData } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  stats?: DashboardOverviewStatsData;
  loading?: boolean;
}

export function DashboardStats({
  stats,
  loading = false,
}: DashboardStatsProps) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const cards = [
    {
      title: isEn ? "Total Contracts" : "合同总数",
      value: stats?.totalContracts ?? 0,
      change: stats?.totalContractsDelta ?? 0,
      icon: FileText,
      hint: isEn ? "vs last 30 days" : "较近 30 天",
    },
    {
      title: isEn ? "Pending Signatures" : "待签署数",
      value: stats?.pendingSignatures ?? 0,
      change: stats?.pendingSignaturesDelta ?? 0,
      icon: Clock3,
      hint: isEn ? "queue delta this week" : "本周队列变化",
    },
    {
      title: isEn ? "Completed" : "已完成合同",
      value: stats?.completedContracts ?? 0,
      change: stats?.completedContractsDelta ?? 0,
      icon: CheckCircle2,
      hint: isEn ? "signed and retained" : "已签署并归档",
    },
    {
      title: isEn ? "Active Parties" : "活跃签约方",
      value: stats?.activeParties ?? 0,
      change: stats?.activePartiesDelta ?? 0,
      icon: Users,
      hint: isEn ? "unique participants" : "去重参与方数量",
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const isTrendUp = card.change >= 0;
        const TrendIcon = isTrendUp ? ArrowUpRight : ArrowDownRight;

        return (
          <Card key={card.title} className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <card.icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    isTrendUp
                      ? "bg-accent/10 text-accent"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {`${card.change > 0 ? "+" : ""}${card.change}`}
                </span>
              </div>

              <p className="text-2xl font-semibold tracking-tight">
                {loading ? "--" : card.value.toLocaleString(isEn ? "en-US" : "zh-CN")}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{card.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
