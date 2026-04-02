"use client";

import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppDisplayName } from "@/lib/config/deployment.config";

const termsContent = {
  en: {
    badge: "Legal",
    title: "Terms of Service",
    description:
      "These terms apply to registration, usage, and subscriptions on {appName}.",
    back: "Back to Sign In",
    updatedPrefix: "Last updated:",
    sections: [
      {
        title: "1. Service Scope",
        content:
          "{appName} provides contract drafting, editing, signing workflow, and archival tools. You must ensure submitted content is lawful and authorized.",
      },
      {
        title: "2. User Responsibilities",
        content:
          "You must protect account credentials and avoid unauthorized, illegal, or abusive usage that may impact platform stability.",
      },
      {
        title: "3. AI Content Disclaimer",
        content:
          "AI-generated output is a draft and should be reviewed by authorized business or legal personnel before signing.",
      },
      {
        title: "4. Limitation of Liability",
        content:
          "Within legal limits, the platform is not liable for indirect losses caused by misuse or unreviewed content.",
      },
      {
        title: "5. Term Updates",
        content:
          "We may update terms for legal or product reasons and notify users through in-app notices or sign-in page messages.",
      },
    ],
  },
  zh: {
    badge: "法律",
    title: "服务条款",
    description: "以下条款适用于 {appName} 的注册、使用与订阅行为。",
    back: "返回登录",
    updatedPrefix: "最近更新：",
    sections: [
      {
        title: "1. 服务范围",
        content:
          "{appName} 提供合同起草、编辑、签署流程管理与归档工具。您需保证上传内容合法、真实且有权处理。",
      },
      {
        title: "2. 用户责任",
        content:
          "您应妥善保管账户凭证，不得进行违法使用、越权访问或影响平台稳定性的行为。",
      },
      {
        title: "3. AI 生成声明",
        content:
          "AI 生成内容仅作为草稿建议，正式签署前应由业务负责人或法律顾问完成复核。",
      },
      {
        title: "4. 责任限制",
        content:
          "在法律允许范围内，平台不对因用户未复核内容或超出服务边界使用造成的间接损失承担责任。",
      },
      {
        title: "5. 条款更新",
        content:
          "我们可能根据法律要求与产品更新调整条款，更新后将通过站内公告或登录页提示。",
      },
    ],
  },
} as const;

function formatText(template: string, appName: string) {
  return template.replaceAll("{appName}", appName);
}

export default function TermsPage() {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const content = termsContent[locale];
  const updatedAt = "February 14, 2026";
  const appName = getAppDisplayName();

  return (
    <PublicInfoShell
      badge={content.badge}
      title={content.title}
      description={formatText(content.description, appName)}
    >
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
              <Scale className="h-6 w-6 text-primary" />
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
                <p className="text-sm leading-6 text-muted-foreground">
                  {formatText(section.content, appName)}
                </p>
              </section>
            ))}
          </CardContent>
        </Card>
      </section>
    </PublicInfoShell>
  );
}
