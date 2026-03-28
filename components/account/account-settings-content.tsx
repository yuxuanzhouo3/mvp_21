"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  CreditCard,
  Globe,
  LogOut,
  MoonStar,
  Save,
  Settings,
  Shield,
  User,
} from "lucide-react";

import type { AccountProfile, AccountTheme } from "@/lib/account/profile";
import {
  normalizeAccountProfile,
} from "@/lib/account/profile";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { isChinaRegion } from "@/lib/config/region";

type ViewMode = "standalone" | "dashboard";

interface AccountSettingsContentProps {
  mode?: ViewMode;
}

export function AccountSettingsContent({
  mode = "standalone",
}: AccountSettingsContentProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { user: currentUser, loading: userLoading, signOut } = useUser();
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const content = useMemo(
    () =>
      language === "zh"
        ? {
            title: "账户设置",
            subtitle: "管理头像外观、通知偏好和账号基础安全设置。",
            loginRequired: "请先登录后再管理账户设置。",
            loginAction: "前往登录",
            overview: "账户概览",
            overviewDesc: "查看当前账号状态并快速进入常用操作。",
            deployment: "部署配置",
            deploymentDesc: "当前环境由部署区域锁定，保证国内版和国际版体验一致。",
            region: "当前区域",
            auth: "认证方案",
            language: "界面语言",
            languageLocked: "已由部署环境锁定",
            appearance: "外观",
            appearanceDesc: "选择账户偏好的界面主题。",
            theme: "主题模式",
            notifications: "通知偏好",
            notificationsDesc: "控制合同协作、提醒和产品消息。",
            security: "工作流偏好",
            securityDesc: "这些设置会跟随当前账号同步。",
            contractReminders: "签署提醒",
            contractRemindersDesc: "在合同待签时发送提醒。",
            productEmails: "产品邮件",
            productEmailsDesc: "接收版本更新、活动和上新通知。",
            inAppNotifications: "站内通知",
            inAppNotificationsDesc: "接收合同状态、签署和协作提醒。",
            autoSaveDrafts: "自动保存草稿",
            autoSaveDraftsDesc: "编辑合同时自动保存最新内容。",
            save: "保存设置",
            saving: "保存中...",
            saved: "设置已保存",
            profile: "个人资料",
            billing: "账单与会员",
            logout: "退出登录",
            free: "免费版",
            active: "生效中",
            inactive: "未开通",
            cnRegion: "中国大陆 (CN)",
            intlRegion: "国际版 (INTL)",
            cnAuth: "邮箱 + 微信登录",
            intlAuth: "邮箱 + Google 登录",
            themeLight: "浅色",
            themeDark: "深色",
            themeSystem: "跟随系统",
          }
        : {
            title: "Account Settings",
            subtitle:
              "Manage avatar appearance, notification preferences, and core account controls.",
            loginRequired: "Please sign in before managing account settings.",
            loginAction: "Go to Sign In",
            overview: "Account Overview",
            overviewDesc: "Review account status and jump to common actions.",
            deployment: "Deployment Setup",
            deploymentDesc:
              "These values are locked by deployment region so CN and INTL stay consistent.",
            region: "Active Region",
            auth: "Authentication",
            language: "Interface Language",
            languageLocked: "Locked by deployment environment",
            appearance: "Appearance",
            appearanceDesc: "Choose the theme preference for this account.",
            theme: "Theme Mode",
            notifications: "Notifications",
            notificationsDesc:
              "Control contract collaboration alerts, reminders, and product messages.",
            security: "Workflow Preferences",
            securityDesc: "These settings stay synced with the current account.",
            contractReminders: "Signature reminders",
            contractRemindersDesc: "Send reminders when contracts are waiting to be signed.",
            productEmails: "Product emails",
            productEmailsDesc: "Receive releases, campaigns, and product updates.",
            inAppNotifications: "In-app notifications",
            inAppNotificationsDesc:
              "Receive contract status, signing, and collaboration alerts.",
            autoSaveDrafts: "Auto-save drafts",
            autoSaveDraftsDesc: "Automatically save your latest contract edits.",
            save: "Save Settings",
            saving: "Saving...",
            saved: "Settings saved",
            profile: "Profile",
            billing: "Billing",
            logout: "Log out",
            free: "Free plan",
            active: "Active",
            inactive: "Inactive",
            cnRegion: "Mainland China (CN)",
            intlRegion: "International (INTL)",
            cnAuth: "Email + WeChat sign in",
            intlAuth: "Email + Google sign in",
            themeLight: "Light",
            themeDark: "Dark",
            themeSystem: "System",
          },
    [language],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!currentUser) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");

        const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
        const headers = await tokenManager.getAuthHeaderAsync();

        if (!headers) {
          router.push("/auth");
          return;
        }

        const response = await fetch("/api/profile", { headers });
        if (!response.ok) {
          throw new Error("Failed to load profile");
        }

        const nextProfile = normalizeAccountProfile(await response.json());
        if (!cancelled) {
          setProfile(nextProfile);
          setTheme(nextProfile.preferences.theme);
        }
      } catch (loadError) {
        console.error("[AccountSettings] Failed to load profile:", loadError);
        if (!cancelled) {
          setError(
            language === "zh"
              ? "加载设置失败，请稍后重试。"
              : "Failed to load settings. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!userLoading) {
      void loadProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [currentUser, language, router, setTheme, userLoading]);

  const profileInitial = useMemo(() => {
    const source = profile?.name || profile?.email || currentUser?.email || "U";
    return source.trim().charAt(0).toUpperCase() || "U";
  }, [currentUser?.email, profile?.email, profile?.name]);

  const statusLabel =
    profile?.subscription_status === "active" ? content.active : content.inactive;
  const planLabel =
    profile?.subscription_plan === "pro"
      ? "Pro"
      : profile?.subscription_plan === "enterprise"
        ? "Enterprise"
        : content.free;

  const updatePreference = <Key extends keyof AccountProfile["preferences"]>(
    key: Key,
    value: AccountProfile["preferences"][Key],
  ) => {
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            preferences: {
              ...prev.preferences,
              [key]: value,
            },
          }
        : prev,
    );

    if (key === "theme") {
      setTheme(value as AccountTheme);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        router.push("/auth");
        return;
      }

      headers["Content-Type"] = "application/json";

      const response = await fetch("/api/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({
          preferences: profile.preferences,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      const nextProfile = normalizeAccountProfile(await response.json());
      setProfile(nextProfile);
      setTheme(nextProfile.preferences.theme);
      setSuccess(content.saved);
    } catch (saveError) {
      console.error("[AccountSettings] Failed to save settings:", saveError);
      setError(
        language === "zh"
          ? "保存设置失败，请稍后重试。"
          : "Failed to save settings. Please try again later.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
      router.replace("/auth");
    } catch (logoutError) {
      console.error("[AccountSettings] Failed to sign out:", logoutError);
      setError(
        language === "zh"
          ? "退出登录失败，请稍后重试。"
          : "Failed to log out. Please try again later.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!currentUser || !profile) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>{content.title}</CardTitle>
          <CardDescription>{content.loginRequired}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/auth")}>{content.loginAction}</Button>
        </CardContent>
      </Card>
    );
  }

  const isStandalone = mode === "standalone";

  return (
    <div className="space-y-6">
      {isStandalone ? (
        <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {content.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {content.subtitle}
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                content.saving
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {content.save}
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {content.overview}
            </CardTitle>
            <CardDescription>{content.overviewDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile.avatar} alt={profile.name || profile.email} />
                <AvatarFallback>{profileInitial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">
                  {profile.name || profile.email}
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {profile.email}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{planLabel}</Badge>
              <Badge variant="outline">{statusLabel}</Badge>
            </div>

            <div className="grid gap-3">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => router.push("/profile")}
              >
                <User className="mr-2 h-4 w-4" />
                {content.profile}
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => router.push("/payment")}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {content.billing}
              </Button>
              <Button
                variant="outline"
                className="justify-start text-red-600 hover:text-red-700"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOut ? `${content.logout}...` : content.logout}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {content.deployment}
              </CardTitle>
              <CardDescription>{content.deploymentDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">{content.region}</div>
                <div className="mt-2 font-medium">
                  {isChinaRegion() ? content.cnRegion : content.intlRegion}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">{content.auth}</div>
                <div className="mt-2 font-medium">
                  {isChinaRegion() ? content.cnAuth : content.intlAuth}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="text-sm text-muted-foreground">{content.language}</div>
                <div className="mt-2 font-medium">
                  {profile.preferences.language === "zh" ? "中文" : "English"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {content.languageLocked}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MoonStar className="h-5 w-5" />
                {content.appearance}
              </CardTitle>
              <CardDescription>{content.appearanceDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="theme-mode">{content.theme}</Label>
              <Select
                value={profile.preferences.theme}
                onValueChange={(value) =>
                  updatePreference("theme", value as AccountTheme)
                }
              >
                <SelectTrigger id="theme-mode" className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{content.themeSystem}</SelectItem>
                  <SelectItem value="light">{content.themeLight}</SelectItem>
                  <SelectItem value="dark">{content.themeDark}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {content.notifications}
              </CardTitle>
              <CardDescription>{content.notificationsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{content.inAppNotifications}</Label>
                  <p className="text-sm text-muted-foreground">
                    {content.inAppNotificationsDesc}
                  </p>
                </div>
                <Switch
                  checked={profile.preferences.notifications}
                  onCheckedChange={(checked) =>
                    updatePreference("notifications", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{content.productEmails}</Label>
                  <p className="text-sm text-muted-foreground">
                    {content.productEmailsDesc}
                  </p>
                </div>
                <Switch
                  checked={profile.preferences.emailUpdates}
                  onCheckedChange={(checked) =>
                    updatePreference("emailUpdates", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {content.security}
              </CardTitle>
              <CardDescription>{content.securityDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{content.autoSaveDrafts}</Label>
                  <p className="text-sm text-muted-foreground">
                    {content.autoSaveDraftsDesc}
                  </p>
                </div>
                <Switch
                  checked={profile.preferences.autoSaveDrafts}
                  onCheckedChange={(checked) =>
                    updatePreference("autoSaveDrafts", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>{content.contractReminders}</Label>
                  <p className="text-sm text-muted-foreground">
                    {content.contractRemindersDesc}
                  </p>
                </div>
                <Switch
                  checked={profile.preferences.contractReminders}
                  onCheckedChange={(checked) =>
                    updatePreference("contractReminders", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {!isStandalone ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              content.saving
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                {content.save}
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
