"use client";

import { CalendarClock, Crown, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MembershipStatusCardProps {
  plan: string;
  status: string;
  expiresAt?: string;
  language?: "zh" | "en";
}

function formatPlan(plan: string, language: "zh" | "en") {
  if (plan === "enterprise") {
    return language === "en" ? "Enterprise" : "企业版";
  }

  if (plan === "pro") {
    return "Pro";
  }

  return language === "en" ? "Free" : "免费版";
}

function formatStatus(status: string, language: "zh" | "en") {
  const map: Record<string, { zh: string; en: string }> = {
    active: { zh: "生效中", en: "Active" },
    inactive: { zh: "未启用", en: "Inactive" },
    paused: { zh: "已暂停", en: "Paused" },
    cancelled: { zh: "已取消", en: "Cancelled" },
    canceled: { zh: "已取消", en: "Cancelled" },
    expired: { zh: "已到期", en: "Expired" },
  };

  return map[status]?.[language] || (language === "en" ? "Inactive" : "未启用");
}

function formatDate(expiresAt: string | undefined, language: "zh" | "en") {
  if (!expiresAt) {
    return language === "en" ? "No expiration date yet" : "暂未设置到期时间";
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }

  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function MembershipStatusCard({
  plan,
  status,
  expiresAt,
  language = "zh",
}: MembershipStatusCardProps) {
  const planLabel = formatPlan(plan, language);
  const statusLabel = formatStatus(status, language);
  const description =
    language === "en"
      ? "Unified membership snapshot across billing, access, and contract features."
      : "统一展示当前会员套餐、状态与有效期，避免各页面信息不一致。";

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4 text-amber-500" />
          {language === "en" ? "Membership Status" : "会员状态"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            {planLabel}
          </Badge>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {language === "en" ? "Expires" : "到期时间"}
            </div>
            <div className="mt-2 text-sm font-medium">{formatDate(expiresAt, language)}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {language === "en" ? "Coverage" : "权益覆盖"}
            </div>
            <div className="mt-2 text-sm font-medium">{description}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
