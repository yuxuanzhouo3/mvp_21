"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { useLanguage } from "@/components/language-provider";

const footerData = {
  en: {
    description: "ContractHub gives teams one console for contract drafting, signing, storage, and billing.",
    product: {
      title: "Console",
      links: [
        { label: "Overview", href: "/dashboard" },
        { label: "Contracts", href: "/dashboard/contracts" },
        { label: "Templates", href: "/dashboard/templates" },
        { label: "Signatures", href: "/dashboard/signatures" },
        { label: "Documents", href: "/dashboard/documents" },
      ],
    },
    resources: {
      title: "Resources",
      links: [
        { label: "Features", href: "/features" },
        { label: "How It Works", href: "/how-it-works" },
        { label: "Pricing", href: "/pricing" },
        { label: "Customers", href: "/customers" },
        { label: "Contact", href: "/contact" },
      ],
    },
    company: {
      title: "Workspace",
      links: [
        { label: "Team", href: "/dashboard/team" },
        { label: "Billing", href: "/dashboard/billing" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: "Admin", href: "/admin" },
      ],
    },
    legal: {
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      signIn: "Sign In",
    },
  },
  zh: {
    description: "ContractHub 为团队提供统一控制台，覆盖合同起草、签署、归档与计费全流程。",
    product: {
      title: "控制台",
      links: [
        { label: "总览", href: "/dashboard" },
        { label: "合同", href: "/dashboard/contracts" },
        { label: "模板", href: "/dashboard/templates" },
        { label: "签署待办", href: "/dashboard/signatures" },
        { label: "文档库", href: "/dashboard/documents" },
      ],
    },
    resources: {
      title: "信息页",
      links: [
        { label: "功能", href: "/features" },
        { label: "工作原理", href: "/how-it-works" },
        { label: "价格", href: "/pricing" },
        { label: "客户案例", href: "/customers" },
        { label: "联系我们", href: "/contact" },
      ],
    },
    company: {
      title: "工作区",
      links: [
        { label: "团队", href: "/dashboard/team" },
        { label: "账单", href: "/dashboard/billing" },
        { label: "设置", href: "/dashboard/settings" },
        { label: "管理后台", href: "/admin" },
      ],
    },
    legal: {
      privacy: "隐私政策",
      terms: "服务条款",
      signIn: "登录",
    },
  },
} as const;

export function Footer() {
  const { language } = useLanguage();
  const locale = language as "en" | "zh";
  const data = footerData[locale];
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 md:px-6">
        <div className="mb-10 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">ContractHub</span>
            </div>
            <p className="text-pretty text-sm text-muted-foreground">{data.description}</p>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{data.product.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.product.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{data.resources.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.resources.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">{data.company.title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.company.links.map((link) => (
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
          <p>© {currentYear} ContractHub. All rights reserved.</p>
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
