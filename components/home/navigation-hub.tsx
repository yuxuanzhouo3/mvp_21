"use client";

import Link from "next/link";
import { ArrowRight, Layers, Sparkles, Users } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sections = {
  en: {
    title: "Browse By Section",
    subtitle: "The main interface is now split into independent pages.",
    items: [
      {
        title: "Product Features",
        description: "Explore capabilities and platform strengths.",
        href: "/features",
        icon: Layers,
      },
      {
        title: "Workflow",
        description: "See the complete contract flow step by step.",
        href: "/how-it-works",
        icon: Sparkles,
      },
      {
        title: "Pricing & Plans",
        description: "Review plan differences and billing options.",
        href: "/pricing",
        icon: ArrowRight,
      },
      {
        title: "Customer Stories",
        description: "View real use cases from CN/US customers.",
        href: "/customers",
        icon: Users,
      },
    ],
  },
  zh: {
    title: "按模块进入",
    subtitle: "主界面已拆分为多个独立页面，避免内容挤在同一屏。",
    items: [
      {
        title: "功能介绍",
        description: "查看平台能力与核心特性。",
        href: "/features",
        icon: Layers,
      },
      {
        title: "工作流程",
        description: "按步骤了解合同生成与签署流程。",
        href: "/how-it-works",
        icon: Sparkles,
      },
      {
        title: "价格方案",
        description: "对比套餐差异与计费方式。",
        href: "/pricing",
        icon: ArrowRight,
      },
      {
        title: "客户案例",
        description: "查看中美客户的实际使用反馈。",
        href: "/customers",
        icon: Users,
      },
    ],
  },
};

export function NavigationHub() {
  const { language } = useLanguage();
  const locale = language as "en" | "zh";
  const content = sections[locale];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
      <div className="mb-8 text-center md:mb-10">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{content.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{content.subtitle}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {content.items.map((item) => (
          <Card key={item.href} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href={item.href}>
                  {locale === "en" ? "Open" : "进入"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
