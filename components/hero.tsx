"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Globe, Shield } from "lucide-react"
import Link from "next/link"
import { getTranslation, type Locale } from "@/lib/i18n"

export function Hero() {
  const [locale] = useState<Locale>("en")
  const t = getTranslation(locale)

  return (
    <section className="container px-4 py-24 md:py-32">
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

        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">{t.hero.subtitle}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/signup">
              {t.hero.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="w-full sm:w-auto bg-transparent">
            <Link href="#demo">{t.hero.demo}</Link>
          </Button>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          <p>{t.hero.platforms}</p>
        </div>
      </div>

      {/* Platform Preview */}
      <div className="mt-16 mx-auto max-w-6xl">
        <div className="relative rounded-xl border border-border bg-card p-2 shadow-2xl">
          <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground">{locale === "en" ? "Platform Preview" : "平台预览"}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
