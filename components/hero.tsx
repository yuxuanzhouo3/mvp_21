"use client";

import Link from "next/link";
import { ArrowRight, Globe, Shield } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { useTranslations, type Language } from "@/lib/i18n";

export function Hero() {
  const { language } = useLanguage();
  const t = useTranslations(language as Language);
  const preview = t.heroPreview;

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

        <h1 className="mb-6 text-4xl font-bold tracking-tight text-balance md:text-6xl lg:text-7xl">
          {t.hero.title}
          <span className="text-primary"> {t.hero.titleHighlight}</span>
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground text-pretty md:text-xl">
          {t.hero.subtitle}
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
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
            className="w-full bg-transparent sm:w-auto"
          >
            <Link href="/features">{t.hero.demo}</Link>
          </Button>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          <p>{t.hero.platforms}</p>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl">
        <div className="relative rounded-xl border border-border bg-card p-2 shadow-2xl">
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
            <div className="flex h-full w-full flex-col gap-4 p-8">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white/90 p-4 shadow-md backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/90">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {preview.contractsTitle}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="rounded bg-gray-100 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                    {preview.filter}
                  </button>
                  <button className="rounded bg-primary px-4 py-1.5 text-sm text-white hover:bg-primary/90">
                    {preview.create}
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 rounded-lg border border-gray-200 bg-white/70 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/70">
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-md transition-colors hover:border-green-300 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-green-700">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-green-100 dark:bg-green-900/30">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {preview.serviceAgreement}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {preview.signedAt}
                    </p>
                  </div>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    {preview.active}
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-md transition-colors hover:border-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-blue-700">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-100 dark:bg-blue-900/30">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {preview.nda}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {preview.pendingSignature}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {preview.pending}
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-md transition-colors hover:border-amber-300 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-amber-700">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-amber-100 dark:bg-amber-900/30">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {preview.employmentContract}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {preview.draftCreated}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {preview.draft}
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

