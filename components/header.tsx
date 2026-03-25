"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Menu, X } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage } = useLanguage();

  const labels = {
    console: language === "en" ? "Console" : "控制台",
    contracts: language === "en" ? "Contracts" : "合同",
    templates: language === "en" ? "Templates" : "模板",
    signatures: language === "en" ? "Signatures" : "签署",
    features: language === "en" ? "Features" : "功能",
    pricing: language === "en" ? "Pricing" : "价格",
    customers: language === "en" ? "Customers" : "客户案例",
    openConsole: language === "en" ? "Open Console" : "进入控制台",
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-xl font-semibold">ContractHub</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            {labels.console}
          </Link>
          <Link
            href="/dashboard/contracts"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.contracts}
          </Link>
          <Link
            href="/dashboard/templates"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.templates}
          </Link>
          <Link
            href="/dashboard/signatures"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.signatures}
          </Link>
          <Link
            href="/features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.features}
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.pricing}
          </Link>
          <Link
            href="/customers"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {labels.customers}
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher currentLocale={language} onLocaleChange={(locale) => setLanguage(locale)} />
          <Button asChild>
            <Link href="/dashboard">{labels.openConsole}</Link>
          </Button>
          <UserMenu />
        </div>

        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileMenuOpen ? (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
            <Link
              href="/dashboard"
              className="text-sm font-semibold"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.console}
            </Link>
            <Link
              href="/dashboard/contracts"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.contracts}
            </Link>
            <Link
              href="/dashboard/templates"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.templates}
            </Link>
            <Link
              href="/dashboard/signatures"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.signatures}
            </Link>
            <Link
              href="/features"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.features}
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.pricing}
            </Link>
            <Link
              href="/customers"
              className="text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.customers}
            </Link>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <LanguageSwitcher currentLocale={language} onLocaleChange={(locale) => setLanguage(locale)} />
              <Button asChild>
                <Link href="/dashboard">{labels.openConsole}</Link>
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
