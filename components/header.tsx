"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Menu, X } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { DemoVideoButton } from "@/components/home/demo-video-button";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  getAppDisplayName,
  isLanguageSwitchingEnabled,
} from "@/lib/config/deployment.config";
import { useTranslations } from "@/lib/i18n";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { language, setLanguage } = useLanguage();
  const t = useTranslations(language);
  const appName = getAppDisplayName();
  const showLanguageSwitcher = isLanguageSwitchingEnabled();
  const labels = t.marketingNav;

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="max-w-[12rem] truncate text-lg font-semibold sm:text-xl">
            {appName}
          </span>
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
          {showLanguageSwitcher ? (
            <LanguageSwitcher
              currentLocale={language}
              onLocaleChange={(locale) => setLanguage(locale)}
            />
          ) : null}
          <DemoVideoButton />
          <Button asChild>
            <Link href="/dashboard">{labels.openConsole}</Link>
          </Button>
          <UserMenu />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <DemoVideoButton />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-card text-foreground"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen ? (
        <div
          id="mobile-nav-panel"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-background pb-[max(env(safe-area-inset-bottom),1rem)] shadow-lg md:hidden"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 md:px-6">
            <Link
              href="/dashboard"
              className="rounded-md px-2 py-2 text-base font-semibold hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.console}
            </Link>
            <Link
              href="/dashboard/contracts"
              className="rounded-md px-2 py-2 text-base font-medium hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.contracts}
            </Link>
            <Link
              href="/dashboard/templates"
              className="rounded-md px-2 py-2 text-base font-medium hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.templates}
            </Link>
            <Link
              href="/dashboard/signatures"
              className="rounded-md px-2 py-2 text-base font-medium hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.signatures}
            </Link>
            <Link
              href="/features"
              className="rounded-md px-2 py-2 text-base font-medium hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.features}
            </Link>
            <Link
              href="/pricing"
              className="rounded-md px-2 py-2 text-base font-medium hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.pricing}
            </Link>
            <Link
              href="/customers"
              className="rounded-md px-2 py-2 text-base font-medium hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.customers}
            </Link>
            <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
              {showLanguageSwitcher ? (
                <LanguageSwitcher
                  currentLocale={language}
                  onLocaleChange={(locale) => setLanguage(locale)}
                />
              ) : null}
              <Button asChild className="w-full">
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  {labels.openConsole}
                </Link>
              </Button>
              <UserMenu />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
