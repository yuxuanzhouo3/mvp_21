"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Search,
  TrendingUp,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardOverview } from "@/lib/dashboard/client";
import type { DashboardActivity } from "@/lib/dashboard/types";

export function MobileDashboard() {
  const { language } = useLanguage();
  const { user } = useUser();
  const isEn = language === "en";
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<DashboardActivity[]>([]);
  const [stats, setStats] = useState({
    totalContracts: 0,
    pendingSignatures: 0,
    completedContracts: 0,
    totalContractsDelta: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      try {
        setLoading(true);
        setError("");
        const result = await getDashboardOverview();
        if (!cancelled) {
          setActivity(result.recentActivity || []);
          setStats({
            totalContracts: result.stats.totalContracts,
            pendingSignatures: result.stats.pendingSignatures,
            completedContracts: result.stats.completedContracts,
            totalContractsDelta: result.stats.totalContractsDelta,
          });
        }
      } catch (loadError) {
        console.error("[MobileDashboard] Failed to load overview:", loadError);
        if (!cancelled) {
          setError(isEn ? "Failed to load dashboard." : "加载移动端概览失败。");
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
  }, [isEn]);

  const filteredActivity = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return activity.slice(0, 5);
    }

    return activity
      .filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(keyword))
      .slice(0, 5);
  }, [activity, search]);

  const statCards = [
    {
      label: isEn ? "Total" : "合同总数",
      value: String(stats.totalContracts),
      icon: FileText,
      color: "text-primary",
    },
    {
      label: isEn ? "Pending" : "待签署",
      value: String(stats.pendingSignatures),
      icon: Clock,
      color: "text-chart-3",
    },
    {
      label: isEn ? "Completed" : "已完成",
      value: String(stats.completedContracts),
      icon: CheckCircle,
      color: "text-accent",
    },
    {
      label: isEn ? "30d Delta" : "30天增量",
      value: `${stats.totalContractsDelta >= 0 ? "+" : ""}${stats.totalContractsDelta}`,
      icon: TrendingUp,
      color: "text-primary",
    },
  ];

  const activityTypeLabel = (type: DashboardActivity["type"]) => {
    switch (type) {
      case "signed":
        return isEn ? "Signed" : "已签署";
      case "pending":
        return isEn ? "Pending" : "处理中";
      case "archived":
        return isEn ? "Archived" : "已归档";
      case "created":
        return isEn ? "Created" : "已创建";
      default:
        return isEn ? "Updated" : "已更新";
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(isEn ? "en-US" : "zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{isEn ? "Dashboard" : "工作台"}</h1>
              <p className="text-sm text-muted-foreground">
                {isEn
                  ? `Welcome back, ${user?.name || user?.email?.split("@")[0] || "there"}`
                  : `欢迎回来，${user?.name || user?.email?.split("@")[0] || "用户"}`}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-semibold text-primary">
                {(user?.name || user?.email || "U").trim().charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isEn ? "Search recent activity..." : "搜索最近活动..."}
              className="pl-9 pr-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pb-4 pt-4">
                <div className="flex flex-col items-center text-center">
                  <stat.icon className={`mb-2 h-5 w-5 ${stat.color}`} />
                  <p className="mb-1 text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEn ? "Recent Activity" : "最近活动"}</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contracts">{isEn ? "View All" : "查看全部"}</Link>
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {isEn ? "Loading dashboard..." : "正在加载工作台..."}
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : filteredActivity.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {isEn ? "No recent activity." : "暂无最近活动。"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredActivity.map((item) => (
              <Card key={item.id} className="transition-colors hover:border-primary/50">
                <CardContent className="pb-4 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <h3 className="truncate font-medium">{item.title}</h3>
                        <Badge variant="outline">{activityTypeLabel(item.type)}</Badge>
                      </div>
                      <p className="mb-2 text-sm text-muted-foreground">{item.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </span>
                        {item.contractId ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/contracts/${item.contractId}?ctx=mobile`}>
                              {isEn ? "Open" : "查看"}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-6">
        <h2 className="mb-4 text-lg font-semibold">{isEn ? "Quick Actions" : "快捷操作"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/create?ctx=mobile">
            <Card className="cursor-pointer transition-colors hover:border-primary/50">
              <CardContent className="pb-4 pt-4">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{isEn ? "New Contract" : "新建合同"}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/mobile/contracts">
            <Card className="cursor-pointer transition-colors hover:border-primary/50">
              <CardContent className="pb-4 pt-4">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{isEn ? "Open Contracts" : "进入合同中心"}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
