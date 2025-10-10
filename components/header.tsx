"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Menu, X, FileText } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { getTranslation, type Locale } from "@/lib/i18n"

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [locale, setLocale] = useState<Locale>("en")
  const t = getTranslation(locale)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">ContractHub</span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#features"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "en" ? "Features" : "功能"}
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "en" ? "How It Works" : "工作原理"}
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "en" ? "Pricing" : "价格"}
          </Link>
          <Link
            href="#resources"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === "en" ? "Resources" : "资源"}
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher currentLocale={locale} onLocaleChange={setLocale} />
          <Button variant="ghost" asChild>
            <Link href="/login">{t.nav.login}</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">{locale === "en" ? "Get Started" : "开始使用"}</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container px-4 py-4 flex flex-col gap-4">
            <Link href="#features" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
              {locale === "en" ? "Features" : "功能"}
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
              {locale === "en" ? "How It Works" : "工作原理"}
            </Link>
            <Link href="#pricing" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
              {locale === "en" ? "Pricing" : "价格"}
            </Link>
            <Link href="#resources" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>
              {locale === "en" ? "Resources" : "资源"}
            </Link>
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <LanguageSwitcher currentLocale={locale} onLocaleChange={setLocale} />
              <Button variant="ghost" asChild>
                <Link href="/login">{t.nav.login}</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">{locale === "en" ? "Get Started" : "开始使用"}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
