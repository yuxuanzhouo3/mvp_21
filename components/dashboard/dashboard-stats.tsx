"use client";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, FileText, Users } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardStats() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const stats = [
    {
      title: isEn ? "Total Contracts" : "合同总数",
      value: "48",
      change: "+12%",
      icon: FileText,
      trend: "up",
      hint: isEn ? "vs last 30 days" : "较过去 30 天",
    },
    {
      title: isEn ? "Pending Signatures" : "待签署",
      value: "7",
      change: "-3",
      icon: Clock3,
      trend: "down",
      hint: isEn ? "queue reduced this week" : "本周队列减少",
    },
    {
      title: isEn ? "Completed" : "已完成",
      value: "41",
      change: "+8",
      icon: CheckCircle2,
      trend: "up",
      hint: isEn ? "signed and archived" : "已签署并归档",
    },
    {
      title: isEn ? "Active Parties" : "活跃参与方",
      value: "23",
      change: "+5",
      icon: Users,
      trend: "up",
      hint: isEn ? "external participants" : "外部参与方",
    },
  ] as const;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const isTrendUp = stat.trend === "up";
        const TrendIcon = isTrendUp ? ArrowUpRight : ArrowDownRight;

        return (
          <Card key={stat.title} className="border-border/70 bg-card/95 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <stat.icon className="h-5 w-5" />
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
                  {stat.change}
                </span>
              </div>

              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-foreground">{stat.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
