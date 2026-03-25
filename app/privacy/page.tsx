"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const privacyContent = {
  en: {
    badge: "Legal",
    title: "Privacy Policy",
    description: "Please review how we process and secure your data before using the service.",
    back: "Back to Sign In",
    updatedPrefix: "Last updated:",
    sections: [
      {
        title: "1. Information We Collect",
        content:
          "We collect account data, contract inputs, and activity logs for authentication, contract processing, and security auditing.",
      },
      {
        title: "2. How We Use Data",
        content:
          "Collected data is used only to provide contract generation, signing, storage, and service notifications.",
      },
      {
        title: "3. Data Security",
        content:
          "We apply access controls, encrypted transport, and audit trails to protect sensitive operations.",
      },
      {
        title: "4. Data Retention",
        content:
          "Data is retained only as required for legal and operational purposes, with deletion requests handled through account settings.",
      },
      {
        title: "5. Contact",
        content:
          "If you have questions about this policy, contact us through the in-app support channel.",
      },
    ],
  },
  zh: {
    badge: "法律",
    title: "隐私政策",
    description: "请在使用服务前阅读并理解以下数据处理与安全说明。",
    back: "返回登录",
    updatedPrefix: "最近更新：",
    sections: [
      {
        title: "1. 信息收集",
        content: "我们会收集您主动提交的账户信息、合同内容与操作日志，用于身份验证、合同处理与安全审计。",
      },
      {
        title: "2. 信息使用",
        content: "收集的数据仅用于提供合同生成、签署、存储与通知服务，不会用于与本服务无关的用途。",
      },
      {
        title: "3. 数据安全",
        content: "我们采用访问控制、传输加密与审计日志机制保护数据，敏感操作会保留安全记录。",
      },
      {
        title: "4. 数据保留",
        content: "在满足法律与业务要求的前提下保存数据。您可在账户设置中申请删除可删除数据。",
      },
      {
        title: "5. 联系方式",
        content: "如您对隐私政策有任何问题，请通过平台内支持渠道联系我们。",
      },
    ],
  },
} as const;

export default function PrivacyPage() {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const content = privacyContent[locale];
  const updatedAt = "February 14, 2026";

  return (
    <PublicInfoShell badge={content.badge} title={content.title} description={content.description}>
      <section className="container mx-auto max-w-3xl px-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/auth">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {content.back}
          </Link>
        </Button>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              {content.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {content.updatedPrefix} {updatedAt}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {content.sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{section.content}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </section>
    </PublicInfoShell>
  );
}
