"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language } = useLanguage();
  const isEn = language === "en";

  const navItems = [
    { href: "/admin", label: isEn ? "Dashboard" : "仪表盘", icon: LayoutDashboard },
    { href: "/admin/users", label: isEn ? "Users" : "用户管理", icon: Users },
    { href: "/admin/ads", label: isEn ? "Ads" : "广告管理", icon: Megaphone },
    { href: "/admin/subscriptions", label: isEn ? "Subscriptions" : "订阅管理", icon: CreditCard },
    { href: "/admin/analytics", label: isEn ? "Analytics" : "数据分析", icon: BarChart3 },
    { href: "/admin/settings", label: isEn ? "Settings" : "系统设置", icon: Settings },
    { href: "/admin/versions", label: isEn ? "Versions" : "版本管理", icon: FileText },
  ];

  const titleMap: Record<string, string> = {
    "/admin": isEn ? "Admin Dashboard" : "管理员仪表盘",
    "/admin/users": isEn ? "User Management" : "用户管理",
    "/admin/ads": isEn ? "Ad Management" : "广告管理",
    "/admin/subscriptions": isEn ? "Subscription Management" : "订阅管理",
    "/admin/analytics": isEn ? "Analytics" : "数据分析",
    "/admin/settings": isEn ? "System Settings" : "系统设置",
    "/admin/versions": isEn ? "Version Management" : "版本管理",
  };

  const pageTitle = useMemo(() => {
    const matched = Object.keys(titleMap).find((key) =>
      key === "/admin" ? pathname === key : pathname.startsWith(key),
    );
    return matched ? titleMap[matched] : isEn ? "Admin Console" : "后台管理";
  }, [pathname, titleMap, isEn]);

  return (
    <div className="min-h-screen bg-muted/25">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={isEn ? "Close admin sidebar" : "关闭后台侧栏"}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-border/70 bg-card/95 backdrop-blur transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">ContractHub Admin</p>
              <p className="text-xs text-muted-foreground">
                {isEn ? "Operations Console" : "运营控制台"}
              </p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label={isEn ? "Close menu" : "关闭菜单"}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-border/70 p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            {isEn ? "Back to site" : "返回前台"}
          </Link>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label={isEn ? "Open menu" : "打开菜单"}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-base font-semibold">{pageTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {isEn ? "Admin Workspace" : "管理工作区"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-md border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground sm:block">
                {isEn ? "Role: Administrator" : "角色：管理员"}
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                A
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
