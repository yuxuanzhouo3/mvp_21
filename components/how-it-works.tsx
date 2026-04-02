"use client";

import { CheckCircle, FileEdit, Shield, UserCheck } from "lucide-react";

import { useLanguage } from "@/components/language-provider";

const stepsData = {
  en: [
    {
      icon: FileEdit,
      title: "Create Contract",
      description:
        "Choose a template or start from imported conversation material inside the guided editor.",
      step: "01",
    },
    {
      icon: UserCheck,
      title: "Confirm Parties",
      description:
        "Review key fields, assign counterparties, and prepare the contract for approval or signature.",
      step: "02",
    },
    {
      icon: Shield,
      title: "Route for Signature",
      description:
        "Send the document through a managed signing flow and keep the latest status visible to the team.",
      step: "03",
    },
    {
      icon: CheckCircle,
      title: "Retain and Track",
      description:
        "Store the final file, signature evidence, and related billing or archive information in one place.",
      step: "04",
    },
  ],
  zh: [
    {
      icon: FileEdit,
      title: "创建合同",
      description: "选择模板，或从导入的聊天内容开始，在引导式编辑器中整理成正式草稿。",
      step: "01",
    },
    {
      icon: UserCheck,
      title: "确认参与方",
      description: "复核关键信息、补齐合同字段，并为审批或签署流程做好准备。",
      step: "02",
    },
    {
      icon: Shield,
      title: "发起签署流程",
      description: "将合同送入可跟踪的签署链路，让团队持续看到当前处理状态。",
      step: "03",
    },
    {
      icon: CheckCircle,
      title: "留存与追踪",
      description: "把最终文件、签署记录和相关计费或归档信息统一保存在同一工作台中。",
      step: "04",
    },
  ],
} as const;

const textData = {
  en: {
    title: "How it works",
    subtitle: "Complete the contract lifecycle in four connected steps.",
  },
  zh: {
    title: "工作流程",
    subtitle: "用四个连续步骤完成从草稿到签署留存的合同流程。",
  },
} as const;

export function HowItWorks() {
  const { language } = useLanguage();
  const locale = language === "en" ? "en" : "zh";
  const steps = stepsData[locale];
  const text = textData[locale];

  return (
    <section id="how-it-works" className="py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-balance md:text-4xl">
            {text.title}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-pretty">
            {text.subtitle}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <step.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step.step}
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-pretty">{step.description}</p>
              </div>
              {index < steps.length - 1 ? (
                <div className="absolute left-[60%] top-8 hidden h-px w-[80%] bg-border lg:block" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
