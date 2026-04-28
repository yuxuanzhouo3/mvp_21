"use client";

import { CheckCircle, Clock, FileText, MessageSquare, Plus } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppDisplayName } from "@/lib/config/deployment.config";

const contracts = {
  en: [
    { id: 1, title: "Service Agreement", status: "pending", date: "2 hours ago" },
    { id: 2, title: "Non-Disclosure Agreement", status: "completed", date: "1 day ago" },
    { id: 3, title: "Cooperation Agreement", status: "draft", date: "3 days ago" },
  ],
  zh: [
    { id: 1, title: "服务协议", status: "pending", date: "2 小时前" },
    { id: 2, title: "保密协议", status: "completed", date: "1 天前" },
    { id: 3, title: "合作协议", status: "draft", date: "3 天前" },
  ],
} as const;

export function WeChatMiniProgram() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const appName = getAppDisplayName();
  const items = isEn ? contracts.en : contracts.zh;

  const statusLabel = (status: string) => {
    if (status === "pending") {
      return isEn ? "Pending" : "待签署";
    }
    if (status === "completed") {
      return isEn ? "Completed" : "已完成";
    }
    return isEn ? "Draft" : "草稿";
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-primary px-4 py-6 text-primary-foreground">
        <h1 className="mb-1 text-xl font-bold">
          {isEn ? "Contract Management" : "合同管理"}
        </h1>
        <p className="text-sm opacity-90">
          {isEn ? `${appName} WeChat Mini Program` : `${appName} 微信小程序`}
        </p>
      </div>

      <div className="-mt-4 mb-4 px-4">
        <Card>
          <CardContent className="pb-4 pt-4">
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="text-center">
                <p className="mb-1 text-2xl font-bold text-primary">7</p>
                <p className="text-xs text-muted-foreground">{isEn ? "Pending" : "待签署"}</p>
              </div>
              <div className="text-center">
                <p className="mb-1 text-2xl font-bold text-accent">41</p>
                <p className="text-xs text-muted-foreground">{isEn ? "Completed" : "已完成"}</p>
              </div>
              <div className="text-center">
                <p className="mb-1 text-2xl font-bold">48</p>
                <p className="text-xs text-muted-foreground">{isEn ? "Total" : "合同总数"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 px-4">
        <div className="grid grid-cols-4 gap-3">
          <button className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "New" : "新建"}</span>
          </button>
          <button className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "Contracts" : "合同"}</span>
          </button>
          <button className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "Tasks" : "待办"}</span>
          </button>
          <button className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xs">{isEn ? "Messages" : "消息"}</span>
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{isEn ? "Recent Contracts" : "最近合同"}</h2>
          <Button variant="ghost" size="sm" className="text-xs">
            {isEn ? "View All" : "查看全部"}
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((contract) => (
            <Card key={contract.id}>
              <CardContent className="pb-3 pt-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="mb-1 text-sm font-medium">{contract.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={contract.status === "completed" ? "default" : "secondary"}
                        className={
                          contract.status === "completed"
                            ? "border-accent/20 bg-accent/10 text-xs text-accent"
                            : contract.status === "pending"
                              ? "border-chart-3/20 bg-chart-3/10 text-xs text-chart-3"
                              : "text-xs"
                        }
                      >
                        {statusLabel(contract.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{contract.date}</span>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
