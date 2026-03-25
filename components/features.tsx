"use client";

import { FileText, Shield, Globe, Smartphone, Zap, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/components/language-provider";
import { useTranslations, type Language } from "@/lib/i18n";

const featuresData = {
  en: [
    {
      icon: FileText,
      title: "Smart Contract Creation",
      description:
        "Create professional contracts with AI-powered templates in minutes. Support for both Chinese and English.",
    },
    {
      icon: Shield,
      title: "E-Signature Compliance",
      description:
        "Legally binding e-signatures compliant with US ESIGN Act and China Electronic Signature Law.",
    },
    {
      icon: Globe,
      title: "Cross-Border Ready",
      description:
        "Seamlessly manage contracts between China and USA with built-in compliance and localization.",
    },
    {
      icon: Smartphone,
      title: "Multi-Platform Access",
      description:
        "Access your contracts anywhere: Web, WeChat Mini Program, iOS, Android, and Desktop apps.",
    },
    {
      icon: Zap,
      title: "Real-Time Collaboration",
      description:
        "Collaborate with team members and clients in real-time with instant notifications and updates.",
    },
    {
      icon: Lock,
      title: "Bank-Level Security",
      description:
        "End-to-end encryption, blockchain verification, and secure cloud storage for all your documents.",
    },
  ],
  zh: [
    {
      icon: FileText,
      title: "智能合同创建",
      description: "使用 AI 驱动的模板在几分钟内创建专业合同。支持中英文双语。",
    },
    {
      icon: Shield,
      title: "电子签名合规",
      description:
        "符合美国 ESIGN 法案和中国电子签名法的具有法律约束力的电子签名。",
    },
    {
      icon: Globe,
      title: "跨境就绪",
      description: "通过内置的合规性和本地化功能，无缝管理中美之间的合同。",
    },
    {
      icon: Smartphone,
      title: "多平台访问",
      description:
        "随时随地访问您的合同：网页、微信小程序、iOS、Android 和桌面应用。",
    },
    {
      icon: Zap,
      title: "实时协作",
      description: "与团队成员和客户实时协作，即时通知和更新。",
    },
    {
      icon: Lock,
      title: "银行级安全",
      description: "端到端加密、区块链验证和安全云存储，保护您的所有文档。",
    },
  ],
};

export function Features() {
  const { language } = useLanguage();
  const t = useTranslations(language as Language);
  const features = featuresData[language as keyof typeof featuresData];

  return (
    <section id="features" className="bg-muted/30 py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            {t.features.title}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {t.features.subtitle}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-border/50 hover:border-primary/50 transition-colors"
            >
              <CardContent className="pt-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-pretty">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
