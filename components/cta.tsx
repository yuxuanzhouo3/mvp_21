"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/components/language-provider"

const textData = {
  en: {
    title: "Ready to modernize your contracts?",
    subtitle: "Join thousands of businesses using ContractHub for secure, compliant digital contracts across China and the USA.",
    cta: "Start Free Trial",
    contact: "Contact Sales",
    disclaimer: "No credit card required • 14-day free trial • Cancel anytime",
  },
  zh: {
    title: "准备好升级您的合同管理了吗？",
    subtitle: "加入数千家使用 ContractHub 进行安全、合规的中美跨境数字合同的企业。",
    cta: "开始免费试用",
    contact: "联系销售",
    disclaimer: "无需信用卡 • 14天免费试用 • 随时取消",
  },
}

export function CTA() {
  const { language } = useLanguage()
  const locale = language as "en" | "zh"
  const text = textData[locale]

  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center shadow-lg">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">{text.title}</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            {text.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
          <p className="mt-6 text-sm text-muted-foreground">
            {text.disclaimer}
          </p>
        </div>
      </div>
    </section>
  )
}
