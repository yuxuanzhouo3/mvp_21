"use client";

import { CheckCircle2, Clock3, FileText, PencilLine } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardActivity } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

interface RecentActivityProps {
  activities?: DashboardActivity[];
  loading?: boolean;
}

function formatRelativeTime(value: string, locale: "zh-CN" | "en-US") {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diff = Date.now() - timestamp;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (diff < hour) {
    const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
    return locale === "en-US" ? `${minutes}m ago` : `${minutes} 分钟前`;
  }

  if (diff < day) {
    const hours = Math.max(1, Math.floor(diff / hour));
    return locale === "en-US" ? `${hours}h ago` : `${hours} 小时前`;
  }

  const days = Math.max(1, Math.floor(diff / day));
  return locale === "en-US" ? `${days}d ago` : `${days} 天前`;
}

export function RecentActivity({
  activities = [],
  loading = false,
}: RecentActivityProps) {
  const { language } = useLanguage();
  const isEn = language === "en";
  const locale = isEn ? "en-US" : "zh-CN";

  const items = activities.map((activity) => {
    if (activity.type === "signed") {
      return {
        ...activity,
        badge: isEn ? "Completed" : "已完成",
        icon: CheckCircle2,
        tone: "text-accent",
      };
    }

    if (activity.type === "pending") {
      return {
        ...activity,
        badge: isEn ? "Pending" : "待处理",
        icon: Clock3,
        tone: "text-chart-3",
      };
    }

    if (activity.type === "created") {
      return {
        ...activity,
        badge: isEn ? "Draft" : "草稿",
        icon: FileText,
        tone: "text-primary",
      };
    }

    if (activity.type === "archived") {
      return {
        ...activity,
        badge: isEn ? "Archived" : "已归档",
        icon: FileText,
        tone: "text-muted-foreground",
      };
    }

    return {
      ...activity,
      badge: isEn ? "Updated" : "已更新",
      icon: PencilLine,
      tone: "text-muted-foreground",
    };
  });

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">
          {isEn ? "Recent Activity" : "最近活动"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-sm text-muted-foreground">
            {isEn ? "Loading recent activity..." : "正在加载最近活动..."}
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-sm text-muted-foreground">
            {isEn ? "No recent activity yet." : "暂无最近活动。"}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((activity) => (
              <div
                key={activity.id}
                className="relative flex gap-3 rounded-lg border border-border/60 bg-muted/15 p-3"
              >
                <div className={cn("mt-0.5 rounded-md bg-muted p-2", activity.tone)}>
                  <activity.icon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {activity.title}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {activity.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{activity.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelativeTime(activity.createdAt, locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
