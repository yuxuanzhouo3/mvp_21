"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { getAppDisplayName } from "@/lib/config/deployment.config";

const textData = {
  en: {
    title: "Ready to put contracts into one workspace?",
    subtitle:
      "helps teams draft, review, sign, and retain contracts in one operating flow.",
    cta: "Create Your First Contract",
    contact: "Contact Sales",
    disclaimer:
      "Start with the current workflow and expand to paid plans when your team is ready.",
  },
  zh: {
    title: "准备把合同流程统一到一个工作台了吗？",
    subtitle: "帮助团队把起草、审批、签署与留存整合进同一套工作流。",
    cta: "开始创建第一份合同",
    contact: "联系销售",
    disclaimer: "可先按当前流程接入，团队需要更多能力时再升级到付费方案。",
  },
} as const;

export function CTA() {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const text = textData[locale];
  const appName = getAppDisplayName();

  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-lg md:p-12">
          <h2 className="mb-4 text-3xl font-bold text-balance md:text-4xl">
            {text.title}
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground text-pretty">
            {appName} {text.subtitle}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/create">
                {text.cta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">{text.contact}</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{text.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
