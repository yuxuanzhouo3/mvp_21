"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { getAppDisplayName } from "@/lib/config/deployment.config";
import { useTranslations } from "@/lib/i18n";

export function Footer() {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const data = t.footer;
  const currentYear = new Date().getFullYear();
  const appName = getAppDisplayName();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">{appName}</span>
            </div>
            <p className="text-pretty text-sm text-muted-foreground">
              {data.description}
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{data.columns.console.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.columns.console.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{data.columns.resources.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.columns.resources.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{data.columns.workspace.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.columns.workspace.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground md:flex-row">
          <p>
            Copyright {currentYear} {appName}. {data.legal.rights}
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              {data.legal.privacy}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              {data.legal.terms}
            </Link>
            <Link href="/auth?mode=signin" className="transition-colors hover:text-foreground">
              {data.legal.signIn}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
