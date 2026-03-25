"use client";

import { CheckCircle2, Clock3, FileText, UserPlus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function RecentActivity() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const activities = [
    {
      type: "signed",
      title: isEn ? "Contract signed" : "合同已签署",
      description: isEn ? "Li Wei signed Service Agreement" : "李伟已签署服务协议",
      time: isEn ? "2h ago" : "2小时前",
      icon: CheckCircle2,
      badge: isEn ? "Completed" : "已完成",
      tone: "text-accent",
    },
    {
      type: "pending",
      title: isEn ? "Signature requested" : "已发起签署请求",
      description: isEn ? "NDA sent to Wang Fang" : "已向王芳发送保密协议",
      time: isEn ? "5h ago" : "5小时前",
      icon: Clock3,
      badge: isEn ? "Pending" : "待处理",
      tone: "text-chart-3",
    },
    {
      type: "created",
      title: isEn ? "Contract created" : "合同已创建",
      description: isEn ? "Partnership Agreement drafted" : "合作协议草稿已生成",
      time: isEn ? "1d ago" : "1天前",
      icon: FileText,
      badge: isEn ? "Draft" : "草稿",
      tone: "text-primary",
    },
    {
      type: "invited",
      title: isEn ? "Party added" : "已添加签约方",
      description: isEn
        ? "John Smith added to Employment Contract"
        : "已将张三加入劳动合同",
      time: isEn ? "2d ago" : "2天前",
      icon: UserPlus,
      badge: isEn ? "Updated" : "已更新",
      tone: "text-muted-foreground",
    },
  ] as const;

  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{isEn ? "Recent Activity" : "最近动态"}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={`${activity.type}-${activity.time}`}
              className="relative flex gap-3 rounded-lg border border-border/60 bg-muted/15 p-3"
            >
              <div className={cn("mt-0.5 rounded-md bg-muted p-2", activity.tone)}>
                <activity.icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{activity.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {activity.badge}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{activity.description}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
