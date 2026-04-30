"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Menu } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { DemoVideoButton } from "@/components/home/demo-video-button";
import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      setMobileMenuOpen(false);
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);

  return (
    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
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
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border/70 bg-card text-foreground transition-colors hover:bg-muted/60"
                aria-label="Toggle menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-panel"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
          </div>
        </nav>
      </header>

      <SheetContent
        id="mobile-nav-panel"
        side="right"
        className="w-full max-w-[20rem] gap-0 p-0 sm:max-w-[22rem]"
      >
        <SheetHeader className="border-b border-border/70 px-4 py-4 text-left">
          <SheetTitle>{appName}</SheetTitle>
          <SheetDescription>
            {language === "en" ? "Quick navigation" : "快捷导航"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-3 text-base font-semibold transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.console}
            </Link>
            <Link
              href="/dashboard/contracts"
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.contracts}
            </Link>
            <Link
              href="/dashboard/templates"
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.templates}
            </Link>
            <Link
              href="/dashboard/signatures"
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.signatures}
            </Link>
            <Link
              href="/features"
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.features}
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.pricing}
            </Link>
            <Link
              href="/customers"
              className="rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-muted/70"
              onClick={() => setMobileMenuOpen(false)}
            >
              {labels.customers}
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
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
            <div className="[&_button]:min-h-11 [&_button]:w-full">
              <UserMenu />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
