"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Shield } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { useTranslations, type Language } from "@/lib/i18n";

export function Hero() {
  const { language } = useLanguage();
  const t = useTranslations(language as Language);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20 md:px-6 md:py-24 lg:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-8 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span>{t.hero.globalPlatform}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>{t.hero.bankSecurity}</span>
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance">
          {t.hero.title}
          <span className="text-primary"> {t.hero.titleHighlight}</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
          {t.hero.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/contracts/new">
              {t.hero.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="w-full sm:w-auto bg-transparent"
          >
            <Link href="/features">{t.hero.demo}</Link>
          </Button>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          <p>{t.hero.platforms}</p>
        </div>
      </div>

      {/* Platform Preview */}
      <div className="mt-16 mx-auto max-w-7xl">
        <div className="relative rounded-xl border border-border bg-card p-2 shadow-2xl">
          <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
            {/* 模拟合同管理界面 */}
            <div className="w-full h-full p-8 flex flex-col gap-4">
              {/* 顶部导航栏 */}
              <div className="flex items-center justify-between bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-4 shadow-md border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {language === "en" ? "My Contracts" : "我的合同"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                    {language === "en" ? "Filter" : "筛选"}
                  </button>
                  <button className="px-4 py-1.5 text-sm text-white bg-primary rounded hover:bg-primary/90">
                    {language === "en" ? "+ New" : "+ 新建"}
                  </button>
                </div>
              </div>

              {/* 合同列表 */}
              <div className="flex-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-lg p-4 space-y-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-lg p-3 shadow-md border border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700 transition-colors">
                  <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {language === "en"
                        ? "Service Agreement - Acme Corp"
                        : "服务协议 - Acme 公司"}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === "en"
                        ? "Signed on Jan 15, 2026"
                        : "签署于 2026年1月15日"}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-full">
                    {language === "en" ? "Active" : "已生效"}
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-lg p-3 shadow-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                  <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {language === "en"
                        ? "NDA - TechStart Inc"
                        : "保密协议 - 科技创业公司"}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === "en" ? "Pending signature" : "待签署"}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    {language === "en" ? "Pending" : "进行中"}
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-gray-700 rounded-lg p-3 shadow-md border border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
                  <div className="w-10 h-10 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {language === "en"
                        ? "Employment Contract - John Doe"
                        : "劳动合同 - 张三"}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === "en" ? "Draft created" : "草稿已创建"}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                    {language === "en" ? "Draft" : "草稿"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
