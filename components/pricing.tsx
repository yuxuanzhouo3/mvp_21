"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/components/language-provider"

const plansData = {
  en: {
    title: "Simple, transparent pricing",
    subtitle: "Choose the plan that's right for you. Upgrade or downgrade anytime.",
    disclaimer: "All plans include 7-day money-back guarantee · 20% off with annual billing",
    plans: [
      {
        name: "Free",
        price: "$0",
        period: "/month",
        description: "Perfect for trying out",
        features: [
          "3 contracts per month",
          "Basic templates",
          "PDF export",
          "7-day cloud storage",
        ],
        cta: "Get Started Free",
        href: "/create",
        popular: false,
      },
      {
        name: "Pro",
        price: "$4.99",
        period: "/month",
        description: "For freelancers and small businesses",
        features: [
          "Unlimited contracts",
          "All templates",
          "PDF + Word export",
          "Permanent cloud storage",
          "Priority AI processing",
          "Email support",
        ],
        cta: "Start Free Trial",
        href: "/signup?plan=pro",
        popular: true,
        popularLabel: "Most Popular",
      },
      {
        name: "Enterprise",
        price: "$14.99",
        period: "/month",
        description: "For teams and companies",
        features: [
          "Everything in Pro",
          "Team collaboration",
          "Custom templates",
          "API access",
          "Dedicated support",
          "Contract review suggestions",
        ],
        cta: "Contact Sales",
        href: "/contact",
        popular: false,
      },
    ],
  },
  zh: {
    title: "简单透明的定价",
    subtitle: "选择适合您的方案，随时可以升级或降级",
    disclaimer: "所有方案均支持 7 天无理由退款 · 按年付费享 8 折优惠",
    plans: [
      {
        name: "免费版",
        price: "¥0",
        period: "/月",
        description: "适合个人用户体验",
        features: [
          "每月 3 份合同",
          "基础合同模板",
          "PDF 导出",
          "7 天云存储",
        ],
        cta: "免费开始",
        href: "/create",
        popular: false,
      },
      {
        name: "专业版",
        price: "¥29",
        period: "/月",
        description: "适合自由职业者和小微企业",
        features: [
          "无限合同生成",
          "全部合同模板",
          "PDF + Word 导出",
          "永久云存储",
          "优先 AI 处理",
          "邮件支持",
        ],
        cta: "开始试用",
        href: "/signup?plan=pro",
        popular: true,
        popularLabel: "最受欢迎",
      },
      {
        name: "企业版",
        price: "¥99",
        period: "/月",
        description: "适合团队和中小企业",
        features: [
          "专业版全部功能",
          "团队协作功能",
          "自定义模板",
          "API 接入",
          "专属客服支持",
          "合同审核建议",
        ],
        cta: "联系销售",
        href: "/contact",
        popular: false,
      },
    ],
  },
}

export function Pricing() {
  const { language } = useLanguage()
  const locale = language as "en" | "zh"
  const data = plansData[locale]

  return (
    <section id="pricing" className="bg-muted/30 py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">{data.title}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            {data.subtitle}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {data.plans.map((plan, index) => (
            <Card
              key={index}
              className={`relative ${
                plan.popular ? "border-primary shadow-lg md:scale-105" : "border-border/50"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-sm font-medium px-3 py-1 rounded-full">
                    {plan.popularLabel}
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {data.disclaimer}
          </p>
        </div>
      </div>
    </section>
  )
}
