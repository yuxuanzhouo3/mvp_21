"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CreditCard,
  FileCheck2,
  FileText,
  Files,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useTranslations } from "@/lib/i18n";

const consoleItems = [
  {
    key: "overview",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "contracts",
    url: "/dashboard/contracts",
    icon: FolderOpen,
  },
  {
    key: "templates",
    url: "/dashboard/templates",
    icon: FileText,
  },
  {
    key: "signatures",
    url: "/dashboard/signatures",
    icon: FileCheck2,
  },
  {
    key: "documents",
    url: "/dashboard/documents",
    icon: Files,
  },
  {
    key: "team",
    url: "/dashboard/team",
    icon: Users,
  },
  {
    key: "billing",
    url: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    key: "settings",
    url: "/dashboard/settings",
    icon: Settings,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguage();
  const { signOut } = useUser();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    contracts: language === "en" ? "Contracts" : "合同",
    templates: language === "en" ? "Templates" : "模板",
    signatures: language === "en" ? "Signatures" : "签署/待办",
    documents: language === "en" ? "Documents" : "文档库",
    team: language === "en" ? "Team" : "团队",
    billing: language === "en" ? "Billing" : "账单",
    settings: language === "en" ? "Settings" : "设置",
    mainMenu: language === "en" ? "Main Menu" : "主菜单",
    quickLinks: language === "en" ? "Quick Links" : "快捷入口",
    plans: language === "en" ? "Plans" : "套餐",
    support: language === "en" ? "Support" : "支持",
    workspace: language === "en" ? "Workspace" : "工作台",
    newContract: language === "en" ? "New Contract" : "新建合同",
    user: language === "en" ? "User" : "用户",
    proPlan: language === "en" ? "Pro Plan" : "专业版",
    myAccount: language === "en" ? "My Account" : "我的账户",
    logout: language === "en" ? "Log out" : "退出登录",
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      router.push("/auth?mode=signin");
    }
  };

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="border-b border-border/70 px-2 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">ContractHub</p>
            <p className="text-xs text-muted-foreground">{labels.workspace}</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="px-2 py-2">
              <Button className="w-full" size="sm" asChild>
                <Link href="/dashboard/contracts/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {labels.newContract}
                </Link>
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-border/70" />

        <SidebarGroup>
          <SidebarGroupLabel>{labels.mainMenu}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {consoleItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/dashboard" && pathname.startsWith(item.url))
                    }
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{labels[item.key as keyof typeof labels]}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-border/70" />

        <SidebarGroup>
          <SidebarGroupLabel>{labels.quickLinks}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/pricing">
                    <CreditCard className="h-4 w-4" />
                    <span>{labels.plans}</span>
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/contact">
                    <Settings className="h-4 w-4" />
                    <span>{labels.support}</span>
                    <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/70">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="w-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">{labels.user}</span>
                    <span className="text-xs text-muted-foreground">{labels.proPlan}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuLabel>{labels.myAccount}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push("/dashboard/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  {labels.settings}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push("/dashboard/billing")}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {labels.billing}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {labels.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
