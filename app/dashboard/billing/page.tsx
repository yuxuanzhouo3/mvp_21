"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";

export default function BillingPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    billing: language === "en" ? "Billing" : "账单",
  };

  const content = t.pages?.billing || {
    title: language === "en" ? "Billing & Plans" : "账单与套餐",
    description:
      language === "en"
        ? "Manage your subscription and billing information."
        : "管理你的订阅方案和账单信息。",
    comparePlans: language === "en" ? "Compare Plans" : "查看套餐",
    currentPlan: language === "en" ? "Current Plan" : "当前套餐",
    contactSales: language === "en" ? "Contact Sales" : "联系销售",
    upgrade: language === "en" ? "Upgrade" : "升级",
    paymentHistory: language === "en" ? "Payment History" : "支付历史",
    paymentHistoryDescription:
      language === "en"
        ? "View your recent payments and invoices"
        : "查看最近支付记录与发票",
    noPaymentHistory: language === "en" ? "No payment history available" : "暂无支付记录",
  };

  const plans =
    language === "en"
      ? [
          {
            name: "Free",
            price: "$0",
            period: "/month",
            features: ["Up to 3 contracts", "Basic templates", "Email support"],
            current: false,
          },
          {
            name: "Pro",
            price: "$29",
            period: "/month",
            features: [
              "Unlimited contracts",
              "All templates",
              "Priority support",
              "Advanced features",
            ],
            current: true,
          },
          {
            name: "Enterprise",
            price: "Custom",
            period: "",
            features: [
              "Everything in Pro",
              "Dedicated support",
              "Custom integrations",
              "SLA guarantee",
            ],
            current: false,
          },
        ]
      : [
          {
            name: "免费版",
            price: "¥0",
            period: "/月",
            features: ["最多 3 份合同", "基础模板", "邮件支持"],
            current: false,
          },
          {
            name: "专业版",
            price: "¥29",
            period: "/月",
            features: ["合同数量不限", "全部模板", "优先支持", "高级功能"],
            current: true,
          },
          {
            name: "企业版",
            price: "定制",
            period: "",
            features: ["包含专业版全部能力", "专属支持", "自定义集成", "SLA 保障"],
            current: false,
          },
        ];

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.billing },
      ]}
      title={content.title}
      description={content.description}
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link href="/pricing">{content.comparePlans}</Link>
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.name} className={plan.current ? "border-primary" : "border-border/70"}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{plan.name}</CardTitle>
                {plan.current ? <Badge>{content.currentPlan}</Badge> : null}
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={`${plan.name}-${feature}`} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.current ? "outline" : "default"}
                disabled={plan.current}
              >
                {plan.current
                  ? content.currentPlan
                  : plan.name.toLowerCase().includes("enterprise") || plan.name.includes("企业")
                    ? content.contactSales
                    : content.upgrade}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>{content.paymentHistory}</CardTitle>
          <CardDescription>{content.paymentHistoryDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{content.noPaymentHistory}</p>
        </CardContent>
      </Card>
    </ConsoleShell>
  );
}
