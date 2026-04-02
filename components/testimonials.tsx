"use client";

import { ArrowUpRight, Building2, FileCheck2, Globe2 } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Card, CardContent } from "@/components/ui/card";

const scenarioData = {
  en: [
    {
      title: "Cross-border services team",
      role: "Sales and legal coordination",
      region: "CN / INTL delivery",
      description:
        "Use shared templates and signer routing to turn negotiation records into service agreements with fewer manual handoffs.",
      outcome: "Faster contract turnaround for recurring deals",
    },
    {
      title: "Supplier operations team",
      role: "Procurement and archive management",
      region: "Multi-entity collaboration",
      description:
        "Keep purchasing contracts, appendices, and evidence files in one retained workspace instead of scattered chat threads and folders.",
      outcome: "Clearer retention and retrieval across procurement cycles",
    },
    {
      title: "Internal approval workflow",
      role: "HR, finance, and business review",
      region: "Desktop and mobile access",
      description:
        "Route draft review, signature tasks, and billing follow-up through one console so teams always know the current document status.",
      outcome: "More predictable handoff between drafting, signing, and billing",
    },
  ],
  zh: [
    {
      title: "跨境服务团队",
      role: "销售与法务协同",
      region: "中国区 / 国际区交付",
      description:
        "通过共享模板、签署流程和分析结果，把谈判记录更快整理成可落地的服务协议，减少人工接力。",
      outcome: "重复性签约场景周转更快",
    },
    {
      title: "供应链运营团队",
      role: "采购与归档管理",
      region: "多主体协作",
      description:
        "把采购合同、补充协议和佐证材料留存在同一工作区，避免散落在聊天记录和多个文件夹里。",
      outcome: "采购周期中的留痕与检索更清晰",
    },
    {
      title: "内部审批流程",
      role: "人事、财务与业务复核",
      region: "桌面端与移动端并行",
      description:
        "将草稿复核、签署待办和计费跟进统一进一个控制台，团队能持续看到合同当前所处阶段。",
      outcome: "起草、签署与付款衔接更稳定",
    },
  ],
} as const;

const sectionText = {
  en: {
    title: "Common contract operating patterns",
    subtitle: "Representative team workflows that fit the current product capabilities.",
    outcomeLabel: "Typical outcome",
  },
  zh: {
    title: "典型合同协作场景",
    subtitle: "更贴近当前产品能力的团队使用方式，而不是演示式客户证言。",
    outcomeLabel: "常见结果",
  },
} as const;

export function Testimonials() {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const items = scenarioData[locale];
  const text = sectionText[locale];

  return (
    <section className="bg-muted/30 py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-balance md:text-4xl">
            {text.title}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
            {text.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, index) => (
            <Card key={item.title} className="border-border/50">
              <CardContent className="pt-6">
                <div className="mb-4 flex items-center gap-2 text-primary">
                  {index === 0 ? (
                    <Globe2 className="h-4 w-4" />
                  ) : index === 1 ? (
                    <Building2 className="h-4 w-4" />
                  ) : (
                    <FileCheck2 className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium uppercase tracking-[0.14em]">
                    {item.region}
                  </span>
                </div>

                <p className="mb-4 text-pretty text-muted-foreground">
                  {item.description}
                </p>

                <div className="border-t border-border pt-4">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.role}</p>

                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-foreground">
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{text.outcomeLabel}</p>
                      <p className="text-muted-foreground">{item.outcome}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
