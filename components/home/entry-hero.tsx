"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, Lock, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export function EntryHero() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-12 pt-16 md:px-6 md:pb-20 md:pt-24">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          {t.entryHero.badge}
        </div>

        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
          {t.hero.title}
          <span className="text-primary"> {t.hero.titleHighlight}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
          {t.entryHero.subtitle}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/auth?mode=signin">
              {t.auth.login}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="w-full sm:w-auto"
          >
            <Link href="/auth?mode=signup">{t.auth.register}</Link>
          </Button>
        </div>

        <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button size="sm" variant="ghost" asChild>
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t.entryHero.console}
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/features">
              <Lock className="mr-2 h-4 w-4" />
              {t.entryHero.overview}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

