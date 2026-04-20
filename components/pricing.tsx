"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAmountByCurrency } from "@/lib/payment/payment-config";

type RuntimePricingData = {
  currency: "CNY" | "USD";
  plans: {
    pro: { monthly: number; yearly: number };
    enterprise: { monthly: number; yearly: number };
  };
};

const plansData = {
  en: {
    title: "Simple, transparent pricing",
    subtitle: "Choose a plan based on volume, team collaboration, and retention needs.",
    disclaimer: "Pricing follows the current product configuration and can be adjusted in admin settings.",
    plans: [
      {
        name: "Free",
        period: "/month",
        description: "For individual trials and lightweight document creation",
        features: [
          "Basic AI-assisted drafting",
          "2 contract generations per month",
          "PDF export",
          "Short-term cloud retention",
        ],
        cta: "Start Free",
        href: "/create",
        popular: false,
      },
      {
        name: "Pro",
        period: "/month",
        description: "For recurring drafting, export, and signing workflows",
        features: [
          "Higher contract volume",
          "Template library access",
          "PDF + Word export",
          "Long-term retention",
          "Priority processing",
          "Email support",
        ],
        cta: "Upgrade to Pro",
        href: "/payment?plan=pro&cycle=monthly&tab=payment",
        popular: true,
        popularLabel: "Recommended",
      },
      {
        name: "Enterprise",
        period: "/month",
        description: "For team permissions, shared templates, and managed onboarding",
        features: [
          "Everything in Pro",
          "Team collaboration",
          "Custom templates",
          "Operational support",
          "Priority issue handling",
          "Multi-role coordination",
        ],
        cta: "Contact Sales",
        href: "/contact",
        popular: false,
      },
    ],
  },
  zh: {
    title: "清晰透明的定价",
    subtitle: "根据合同量、团队协作方式和留存需求选择合适版本。",
    disclaimer: "定价以当前系统配置为准，管理员可在后台动态调整。",
    plans: [
      {
        name: "免费版",
        period: "/月",
        description: "适合个人试用和轻量级合同起草",
        features: [
          "基础 AI 辅助起草",
          "每月最多 2 份合同生成",
          "PDF 导出",
          "短期云端留存",
        ],
        cta: "开始免费使用",
        href: "/create",
        popular: false,
      },
      {
        name: "专业版",
        period: "/月",
        description: "适合持续起草、导出和签署协作流程",
        features: [
          "更高合同生成额度",
          "模板库使用权限",
          "PDF + Word 导出",
          "长期留存",
          "优先处理",
          "邮件支持",
        ],
        cta: "升级到专业版",
        href: "/payment?plan=pro&cycle=monthly&tab=payment",
        popular: true,
        popularLabel: "推荐方案",
      },
      {
        name: "企业版",
        period: "/月",
        description: "适合团队权限管理、共享模板和协同落地",
        features: [
          "包含专业版全部能力",
          "团队协作",
          "自定义模板",
          "运营支持",
          "优先问题处理",
          "多角色协同",
        ],
        cta: "联系销售",
        href: "/contact",
        popular: false,
      },
    ],
  },
} as const;

function formatPrice(value: number, currency: "CNY" | "USD", locale: "en" | "zh") {
  if (value === 0) {
    return locale === "en" ? "$0" : "￥0";
  }

  return new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "CNY" ? 0 : 2,
  }).format(value);
}

export function Pricing() {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const data = plansData[locale];
  const [runtimePricing, setRuntimePricing] = useState<RuntimePricingData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPricing() {
      try {
        const response = await fetch("/api/pricing", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: RuntimePricingData };
        if (!cancelled && payload.data) {
          setRuntimePricing(payload.data);
        }
      } catch (error) {
        console.warn("[Pricing] Failed to load runtime pricing:", error);
      }
    }

    void fetchPricing();

    return () => {
      cancelled = true;
    };
  }, []);

  const currency = runtimePricing?.currency || (locale === "zh" ? "CNY" : "USD");

  const displayPrices = useMemo(() => {
    const fallbackPro = getAmountByCurrency(currency, "monthly", "pro");
    const fallbackEnterprise = getAmountByCurrency(currency, "monthly", "enterprise");

    return {
      free: formatPrice(0, currency, locale),
      pro: formatPrice(runtimePricing?.plans.pro.monthly ?? fallbackPro, currency, locale),
      enterprise: formatPrice(runtimePricing?.plans.enterprise.monthly ?? fallbackEnterprise, currency, locale),
    };
  }, [currency, locale, runtimePricing]);

  return (
    <section id="pricing" className="bg-muted/30 py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-balance md:text-4xl">{data.title}</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">{data.subtitle}</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {data.plans.map((plan) => {
            const price =
              plan.name === "Pro" || plan.name === "专业版"
                ? displayPrices.pro
                : plan.name === "Enterprise" || plan.name === "企业版"
                  ? displayPrices.enterprise
                  : displayPrices.free;

            return (
              <Card
                key={plan.name}
                className={`relative ${plan.popular ? "border-primary shadow-lg md:scale-105" : "border-border/50"}`}
              >
                {plan.popular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
                      {plan.popularLabel}
                    </span>
                  </div>
                ) : null}
                <CardHeader className="pb-4 text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"} asChild>
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">{data.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}

