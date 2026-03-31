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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const consoleItems = [
  { key: "overview", url: "/dashboard", icon: LayoutDashboard },
  { key: "contracts", url: "/dashboard/contracts", icon: FolderOpen },
  { key: "templates", url: "/dashboard/templates", icon: FileText },
  { key: "signatures", url: "/dashboard/signatures", icon: FileCheck2 },
  { key: "documents", url: "/dashboard/documents", icon: Files },
  { key: "team", url: "/dashboard/team", icon: Users },
  { key: "billing", url: "/dashboard/billing", icon: CreditCard },
  { key: "settings", url: "/dashboard/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguage();
  const { user, signOut } = useUser();
  const isEn = language === "en";

  const labels = {
    overview: isEn ? "Overview" : "总览",
    contracts: isEn ? "Contracts" : "合同",
    templates: isEn ? "Templates" : "模板",
    signatures: isEn ? "Signatures" : "签署流程",
    documents: isEn ? "Documents" : "文档库",
    team: isEn ? "Team" : "团队",
    billing: isEn ? "Billing" : "账单",
    settings: isEn ? "Settings" : "设置",
    mainMenu: isEn ? "Main Menu" : "主菜单",
    quickLinks: isEn ? "Quick Links" : "快捷入口",
    plans: isEn ? "Plans" : "套餐",
    support: isEn ? "Support" : "支持",
    workspace: isEn ? "Workspace" : "工作区",
    newContract: isEn ? "New Contract" : "新建合同",
    user: isEn ? "User" : "用户",
    myAccount: isEn ? "My Account" : "我的账户",
    logout: isEn ? "Log out" : "退出登录",
  } as const;

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      router.push("/auth?mode=signin");
    }
  };

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || labels.user;
  const userInitial = displayName.trim().charAt(0).toUpperCase() || "U";
  const planLabel =
    user?.subscription_plan === "pro"
      ? "Pro"
      : user?.subscription_plan === "enterprise"
        ? "Enterprise"
        : isEn
          ? "Free plan"
          : "免费版";

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
                    <AvatarImage src={user?.avatar} alt={displayName} />
                    <AvatarFallback>{userInitial}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex flex-col items-start text-left">
                    <span className="max-w-[10rem] truncate text-sm font-medium">
                      {displayName}
                    </span>
                    <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                      {planLabel}
                    </span>
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
