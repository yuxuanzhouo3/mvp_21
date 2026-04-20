"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogoutAction } from "@/actions/admin-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  CreditCard,
  Image,
  FolderOpen,
  Settings,
  LogOut,
  User,
  Package,
  Link as LinkIcon,
  AlertTriangle,
  Sparkles,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isChinaRegion } from "@/lib/config/region";

interface AdminSidebarProps {
  username: string;
  role: "admin" | "super_admin";
}

function getRegion(): "CN" | "INTL" {
  return isChinaRegion() ? "CN" : "INTL";
}

const isIntlRegion = getRegion() === "INTL";

const copy = {
  brand: isIntlRegion ? "Admin Console" : "管理后台",
  roleSuper: isIntlRegion ? "Super Admin" : "超级管理员",
  roleAdmin: isIntlRegion ? "Admin" : "管理员",
  logout: isIntlRegion ? "Sign out" : "退出登录",
  nav: {
    dashboard: isIntlRegion ? "Analytics" : "数据统计",
    pricing: isIntlRegion ? "Pricing" : "定价管理",
    payments: isIntlRegion ? "Payments" : "支付记录",
    reports: isIntlRegion ? "Reports" : "举报管理",
    ads: isIntlRegion ? "Ads" : "广告管理",
    socialLinks: isIntlRegion ? "Social Links" : "社交链接",
    releases: isIntlRegion ? "Releases" : "发布版本",
    files: isIntlRegion ? "Files" : "文件管理",
    aiStudio: isIntlRegion ? "AI Studio" : "AI 创意中心",
    settings: isIntlRegion ? "Settings" : "系统设置",
  },
};

const navItems = [
  { href: "/admin/dashboard", label: copy.nav.dashboard, icon: LayoutDashboard },
  { href: "/admin/pricing", label: copy.nav.pricing, icon: Tags },
  { href: "/admin/payments", label: copy.nav.payments, icon: CreditCard },
  { href: "/admin/reports", label: copy.nav.reports, icon: AlertTriangle },
  { href: "/admin/ads", label: copy.nav.ads, icon: Image },
  { href: "/admin/social-links", label: copy.nav.socialLinks, icon: LinkIcon },
  { href: "/admin/releases", label: copy.nav.releases, icon: Package },
  { href: "/admin/files", label: copy.nav.files, icon: FolderOpen },
  { href: "/admin/ai-studio", label: copy.nav.aiStudio, icon: Sparkles },
  { href: "/admin/settings", label: copy.nav.settings, icon: Settings },
];

export default function AdminSidebar({ username, role }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">{copy.brand}</span>
        </Link>
        <div className="mt-2">
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
            {role === "super_admin" ? copy.roleSuper : copy.roleAdmin}
          </span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 px-4 py-2 mb-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{username}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {role === "super_admin" ? copy.roleSuper : copy.roleAdmin}
            </p>
          </div>
        </div>

        <form action={adminLogoutAction}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {copy.logout}
          </Button>
        </form>
      </div>
    </aside>
  );
}

