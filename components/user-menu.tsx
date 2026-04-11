"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  User,
  UserPlus,
} from "lucide-react";

import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "@/lib/i18n";
import { normalizeAvatarSrc } from "@/lib/account/avatar";

export function UserMenu() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user, loading, refreshUser, signOut } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const t = useTranslations(language);

  const labels = useMemo(
    () =>
      language === "zh"
        ? {
            dashboard: "控制台",
            signIn: "登录",
            signUp: "注册",
            free: "免费版",
            active: "生效中",
            inactive: "未开通",
          }
        : {
            dashboard: "Console",
            signIn: "Sign In",
            signUp: "Sign Up",
            free: "Free plan",
            active: "Active",
            inactive: "Inactive",
          },
    [language],
  );

  const displayName = useMemo(() => {
    if (user?.name?.trim()) {
      return user.name.trim();
    }

    if (user?.email) {
      return user.email.split("@")[0] || user.email;
    }

    return "User";
  }, [user?.email, user?.name]);

  const userInitial = useMemo(
    () => displayName.trim().charAt(0).toUpperCase() || "U",
    [displayName],
  );
  const avatarSrc = useMemo(() => normalizeAvatarSrc(user?.avatar), [user?.avatar]);

  const planLabel =
    user?.subscription_plan === "pro"
      ? "Pro"
      : user?.subscription_plan === "enterprise"
        ? "Enterprise"
        : labels.free;
  const statusLabel =
    user?.subscription_status === "active" ? labels.active : labels.inactive;

  const handleMenuOpenChange = async (open: boolean) => {
    setMenuOpen(open);

    if (open && user) {
      try {
        await refreshUser();
      } catch (error) {
        console.error("[UserMenu] Failed to refresh user:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
      router.replace("/auth");
    } catch (error) {
      console.error("[UserMenu] Failed to log out:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading && !user) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    );
  }

  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <User className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => router.push("/auth?mode=signin")}>
            <LogIn className="mr-2 h-4 w-4" />
            {labels.signIn}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/auth?mode=signup")}>
            <UserPlus className="mr-2 h-4 w-4" />
            {labels.signUp}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarSrc} alt={displayName} />
            <AvatarFallback className="text-xs">{userInitial}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-28 truncate text-sm md:inline">
            {displayName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{displayName}</div>
              <div className="truncate text-xs text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{planLabel}</Badge>
            <Badge variant="outline">{statusLabel}</Badge>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => router.push("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          {labels.dashboard}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/profile")}>
          <User className="mr-2 h-4 w-4" />
          {t.user.profile}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          {t.user.settings}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/payment")}>
          <CreditCard className="mr-2 h-4 w-4" />
          {t.user.billing}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={handleLogout}
          className="text-red-600 focus:text-red-600"
          disabled={loggingOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loggingOut ? `${t.user.logout}...` : t.user.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
