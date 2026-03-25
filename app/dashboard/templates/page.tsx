"use client";

import { FileText } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";

export default function TemplatesPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    templates: language === "en" ? "Templates" : "模板",
  };

  const content = t.pages?.templates || {
    title: language === "en" ? "Contract Templates" : "合同模板",
    description:
      language === "en"
        ? "Choose from pre-built templates to get started quickly."
        : "从预置模板快速开始创建合同。",
    useTemplate: language === "en" ? "Use Template" : "使用模板",
  };

  const templates =
    language === "en"
      ? [
          {
            id: 1,
            name: "Service Agreement",
            description: "Standard service agreement for B2B transactions",
            category: "Business",
          },
          {
            id: 2,
            name: "Non-Disclosure Agreement",
            description: "NDA for protecting confidential information",
            category: "Legal",
          },
          {
            id: 3,
            name: "Employment Contract",
            description: "Standard employment agreement template",
            category: "HR",
          },
          {
            id: 4,
            name: "Partnership Agreement",
            description: "Template for business partnership agreements",
            category: "Business",
          },
        ]
      : [
          {
            id: 1,
            name: "服务协议",
            description: "适用于 B2B 交易的标准服务合同模板",
            category: "商务",
          },
          {
            id: 2,
            name: "保密协议",
            description: "用于保护机密信息的 NDA 模板",
            category: "法务",
          },
          {
            id: 3,
            name: "雇佣合同",
            description: "标准雇佣合同模板",
            category: "人事",
          },
          {
            id: 4,
            name: "合作协议",
            description: "适用于企业合作关系的合同模板",
            category: "商务",
          },
        ];

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.templates },
      ]}
      title={content.title}
      description={content.description}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className="cursor-pointer border-border/70 bg-card/95 shadow-sm transition-colors hover:border-primary/50"
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription className="text-xs">{template.category}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">{template.description}</p>
              <Button size="sm" className="w-full">
                {content.useTemplate}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </ConsoleShell>
  );
}
