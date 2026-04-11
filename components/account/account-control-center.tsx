"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  CreditCard,
  Globe,
  ImagePlus,
  Laptop,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  Shield,
  Smartphone,
  User,
} from "lucide-react";

import {
  normalizeAccountProfile,
  type AccountProfile,
  type AccountTheme,
} from "@/lib/account/profile";
import { normalizeAvatarSrc } from "@/lib/account/avatar";
import { MembershipStatusCard } from "@/components/account/membership-status-card";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type SettingsTab = "overview" | "notifications" | "security" | "sessions";

interface AccountControlCenterProps {
  defaultTab?: SettingsTab;
}

const text = {
  zh: {
    title: "账户设置中心",
    subtitle: "统一管理资料、通知、安全与会话控制。",
    save: "保存更改",
    saving: "保存中...",
    loadFailed: "加载账户资料失败，请稍后重试。",
    saveFailed: "保存设置失败，请稍后重试。",
    saved: "设置已保存。",
    loginRequired: "请先登录后再管理账户设置。",
    loginAction: "前往登录",
    overview: "资料总览",
    notifications: "通知偏好",
    security: "安全设置",
    sessions: "会话管理",
    basicInfo: "基础资料",
    basicInfoDesc: "支持头像上传、手机号维护与会员状态统一查看。",
    displayName: "显示名称",
    avatar: "头像",
    phone: "手机号",
    theme: "主题",
    company: "企业资料页",
    billing: "账单与会员",
    logout: "退出登录",
    currentPlan: "当前套餐",
    notificationsDesc: "细化管理合同提醒、邮件偏好与协作通知。",
    inApp: "站内通知",
    desktop: "桌面提醒",
    wechat: "微信提醒",
    feishu: "飞书提醒",
    productEmail: "产品邮件",
    contractReminder: "合同跟进提醒",
    signatureReminder: "签署催办提醒",
    billingEmail: "账单邮件",
    marketingEmail: "营销邮件",
    weeklyDigest: "每周摘要",
    securityDesc: "控制密码、双重验证、可信设备与登录告警。",
    password: "新密码",
    confirmPassword: "确认新密码",
    updatePassword: "更新密码",
    updatingPassword: "更新中...",
    passwordUpdated: "密码已更新，即将重新登录。",
    passwordFailed: "密码更新失败，请稍后重试。",
    twoFactor: "双重验证",
    loginAlerts: "异地登录提醒",
    trustedOnly: "仅允许可信设备",
    passkey: "启用 Passkey",
    timeout: "空闲超时",
    minutes: "分钟",
    lastPasswordUpdated: "最近一次密码更新",
    noPasswordUpdate: "暂无记录",
    sessionsDesc: "查看当前设备、近期登录会话，并快速撤销其它设备访问。",
    currentSession: "当前会话",
    trustedDevice: "可信设备",
    revoke: "撤销",
    revokeOthers: "撤销其它会话",
    noSessions: "暂无其它会话记录",
    uploadAvatar: "上传头像",
    avatarHint: "支持 JPG / PNG / WebP，将自动压缩为轻量头像。",
    authRequired: "当前登录已失效，请重新登录。",
  },
  en: {
    title: "Account Control Center",
    subtitle: "Manage profile, notifications, security, and sessions in one place.",
    save: "Save Changes",
    saving: "Saving...",
    loadFailed: "Failed to load account profile.",
    saveFailed: "Failed to save settings.",
    saved: "Settings saved.",
    loginRequired: "Please sign in before managing account settings.",
    loginAction: "Go to Sign In",
    overview: "Overview",
    notifications: "Notifications",
    security: "Security",
    sessions: "Sessions",
    basicInfo: "Basic Profile",
    basicInfoDesc: "Upload your avatar, maintain contact details, and view unified membership status.",
    displayName: "Display name",
    avatar: "Avatar",
    phone: "Phone",
    theme: "Theme",
    company: "Company Profiles",
    billing: "Billing",
    logout: "Sign Out",
    currentPlan: "Current plan",
    notificationsDesc: "Fine-tune contract reminders, email preferences, and collaboration alerts.",
    inApp: "In-app notifications",
    desktop: "Desktop alerts",
    wechat: "WeChat alerts",
    feishu: "Feishu alerts",
    productEmail: "Product emails",
    contractReminder: "Contract reminders",
    signatureReminder: "Signature reminders",
    billingEmail: "Billing emails",
    marketingEmail: "Marketing emails",
    weeklyDigest: "Weekly digest",
    securityDesc: "Control password, two-factor authentication, trusted devices, and login alerts.",
    password: "New password",
    confirmPassword: "Confirm password",
    updatePassword: "Update password",
    updatingPassword: "Updating...",
    passwordUpdated: "Password updated. You will be signed out shortly.",
    passwordFailed: "Failed to update password.",
    twoFactor: "Two-factor authentication",
    loginAlerts: "Login alerts",
    trustedOnly: "Trusted devices only",
    passkey: "Passkey enabled",
    timeout: "Idle timeout",
    minutes: "minutes",
    lastPasswordUpdated: "Last password update",
    noPasswordUpdate: "No password update recorded",
    sessionsDesc: "Review the current device, recent sessions, and revoke other access quickly.",
    currentSession: "Current session",
    trustedDevice: "Trusted device",
    revoke: "Revoke",
    revokeOthers: "Revoke other sessions",
    noSessions: "No other sessions recorded",
    uploadAvatar: "Upload avatar",
    avatarHint: "Supports JPG / PNG / WebP and will be compressed automatically.",
    authRequired: "Your session expired. Please sign in again.",
  },
} as const;

async function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

async function compressAvatar(file: File) {
  const dataUrl = await readAsDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const maxSize = 320;
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("canvas_unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => reject(new Error("decode_failed"));
    image.src = dataUrl;
  });
}

function formatDate(value: string | undefined, locale: "zh" | "en") {
  if (!value) {
    return locale === "en" ? "N/A" : "暂无";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AccountControlCenter({
  defaultTab = "overview",
}: AccountControlCenterProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const { language } = useLanguage();
  const { user, loading: userLoading, refreshUser, signOut } = useUser();
  const content = language === "en" ? text.en : text.zh;

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) {
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
          router.replace("/auth");
          return;
        }

        const response = await fetch("/api/profile", {
          headers,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("load_failed");
        }

        const nextProfile = normalizeAccountProfile(await response.json());
        if (!cancelled) {
          setProfile(nextProfile);
          setTheme(nextProfile.preferences.theme);
        }
      } catch (loadError) {
        console.error("[AccountControlCenter] Failed to load profile:", loadError);
        if (!cancelled) {
          setError(content.loadFailed);
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
  }, [content.loadFailed, router, setTheme, user, userLoading]);

  const profileInitial = useMemo(() => {
    const source = profile?.name || profile?.email || user?.email || "U";
    return source.trim().charAt(0).toUpperCase() || "U";
  }, [profile?.email, profile?.name, user?.email]);
  const avatarSrc = useMemo(() => normalizeAvatarSrc(profile?.avatar), [profile?.avatar]);

  const updateProfile = <K extends keyof AccountProfile>(
    key: K,
    value: AccountProfile[K],
  ) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  };

  const updatePreference = <K extends keyof AccountProfile["preferences"]>(
    key: K,
    value: AccountProfile["preferences"][K],
  ) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            preferences: {
              ...current.preferences,
              [key]: value,
            },
          }
        : current,
    );

    if (key === "theme") {
      setTheme(value as AccountTheme);
    }
  };

  const updateSecurity = <K extends keyof AccountProfile["security"]>(
    key: K,
    value: AccountProfile["security"][K],
  ) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            security: {
              ...current.security,
              [key]: value,
            },
          }
        : current,
    );
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const avatar = await compressAvatar(file);
      updateProfile("avatar", avatar);
    } catch (uploadError) {
      console.error("[AccountControlCenter] Failed to process avatar:", uploadError);
      setError(content.saveFailed);
    } finally {
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!profile) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        setError(content.authRequired);
        router.replace("/auth");
        return;
      }

      headers["Content-Type"] = "application/json";

      const response = await fetch("/api/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: profile.name,
          avatar: profile.avatar,
          phone: profile.phone,
          preferences: profile.preferences,
          security: profile.security,
          sessions: profile.sessions.filter((session) => !session.current),
          activeCompanyProfileId: profile.activeCompanyProfileId,
        }),
      });

      if (!response.ok) {
        throw new Error("save_failed");
      }

      const nextProfile = normalizeAccountProfile(await response.json());
      setProfile(nextProfile);
      setTheme(nextProfile.preferences.theme);
      await refreshUser();
      setSuccess(content.saved);
    } catch (saveError) {
      console.error("[AccountControlCenter] Failed to save profile:", saveError);
      setError(content.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (password.length < 6 || password !== confirmPassword) {
      setError(content.passwordFailed);
      return;
    }

    try {
      setUpdatingPassword(true);
      setError("");
      setSuccess("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        setError(content.authRequired);
        router.replace("/auth");
        return;
      }

      headers["Content-Type"] = "application/json";

      const response = await fetch("/api/auth/update", {
        method: "POST",
        headers,
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error("password_failed");
      }

      setPassword("");
      setConfirmPassword("");
      updateSecurity("lastPasswordUpdatedAt", new Date().toISOString());
      setSuccess(content.passwordUpdated);
      window.setTimeout(async () => {
        await signOut();
        router.replace("/auth");
      }, 1000);
    } catch (passwordError) {
      console.error("[AccountControlCenter] Failed to update password:", passwordError);
      setError(content.passwordFailed);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            sessions: current.sessions.filter((session) => session.id !== sessionId),
          }
        : current,
    );
  };

  const handleRevokeOtherSessions = () => {
    setProfile((current) =>
      current
        ? {
            ...current,
            sessions: current.sessions.filter((session) => session.current),
          }
        : current,
    );
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <Card>
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-card/95 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{content.subtitle}</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? content.saving : content.save}
          </Button>
        </div>
      </div>

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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsTab)}>
        <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-4">
          <TabsTrigger value="overview">{content.overview}</TabsTrigger>
          <TabsTrigger value="notifications">{content.notifications}</TabsTrigger>
          <TabsTrigger value="security">{content.security}</TabsTrigger>
          <TabsTrigger value="sessions">{content.sessions}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.9fr]">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {content.basicInfo}
                </CardTitle>
                <CardDescription>{content.basicInfoDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarSrc} alt={profile.name || profile.email} />
                    <AvatarFallback className="text-lg">{profileInitial}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Label
                      htmlFor="avatar-upload"
                      className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {content.uploadAvatar}
                    </Label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <p className="text-xs text-muted-foreground">{content.avatarHint}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="control-center-name">{content.displayName}</Label>
                    <Input
                      id="control-center-name"
                      value={profile.name}
                      onChange={(event) => updateProfile("name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="control-center-phone">{content.phone}</Label>
                    <Input
                      id="control-center-phone"
                      value={profile.phone}
                      onChange={(event) => updateProfile("phone", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="control-center-email">Email</Label>
                    <Input id="control-center-email" value={profile.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="control-center-theme">{content.theme}</Label>
                    <Select
                      value={profile.preferences.theme}
                      onValueChange={(value) =>
                        updatePreference("theme", value as AccountTheme)
                      }
                    >
                      <SelectTrigger id="control-center-theme">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Button variant="outline" onClick={() => router.push("/profile")}>
                    <User className="mr-2 h-4 w-4" />
                    {content.overview}
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/companies")}>
                    <Globe className="mr-2 h-4 w-4" />
                    {content.company}
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/payment")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {content.billing}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <MembershipStatusCard
                plan={profile.subscription_plan}
                status={profile.subscription_status}
                expiresAt={profile.membership_expires_at || profile.subscription_expires_at}
                language={language}
              />

              <Card className="border-border/70 bg-card/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4" />
                    {content.currentPlan}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{profile.subscription_plan}</Badge>
                    <Badge variant="outline">{profile.subscription_status}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await signOut();
                      router.replace("/auth");
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {content.logout}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                {content.notifications}
              </CardTitle>
              <CardDescription>{content.notificationsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                ["notifications", content.inApp],
                ["desktopAlerts", content.desktop],
                ["wechatAlerts", content.wechat],
                ["feishuAlerts", content.feishu],
                ["emailUpdates", content.productEmail],
                ["contractReminders", content.contractReminder],
                ["signatureReminders", content.signatureReminder],
                ["billingEmails", content.billingEmail],
                ["marketingEmails", content.marketingEmail],
                ["weeklyDigest", content.weeklyDigest],
              ].map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4"
                >
                  <Label>{label}</Label>
                  <Switch
                    checked={Boolean(profile.preferences[key as keyof typeof profile.preferences])}
                    onCheckedChange={(checked) =>
                      updatePreference(
                        key as keyof typeof profile.preferences,
                        checked as never,
                      )
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {content.security}
              </CardTitle>
              <CardDescription>{content.securityDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                ["twoFactorEnabled", content.twoFactor],
                ["loginAlerts", content.loginAlerts],
                ["trustedDevicesOnly", content.trustedOnly],
                ["passkeyEnabled", content.passkey],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Label>{label}</Label>
                  <Switch
                    checked={Boolean(profile.security[key as keyof typeof profile.security])}
                    onCheckedChange={(checked) =>
                      updateSecurity(
                        key as keyof typeof profile.security,
                        checked as never,
                      )
                    }
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="session-timeout">{content.timeout}</Label>
                <Select
                  value={String(profile.security.sessionTimeoutMinutes)}
                  onValueChange={(value) =>
                    updateSecurity("sessionTimeoutMinutes", Number(value))
                  }
                >
                  <SelectTrigger id="session-timeout" className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[30, 60, 120, 240].map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {minutes} {content.minutes}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                {content.lastPasswordUpdated}:{" "}
                {profile.security.lastPasswordUpdatedAt
                  ? formatDate(profile.security.lastPasswordUpdatedAt, language)
                  : content.noPasswordUpdate}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="security-password">{content.password}</Label>
                  <Input
                    id="security-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="security-confirm-password">{content.confirmPassword}</Label>
                  <Input
                    id="security-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handlePasswordUpdate} disabled={updatingPassword}>
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  {updatingPassword ? content.updatingPassword : content.updatePassword}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Laptop className="h-5 w-5" />
                {content.sessions}
              </CardTitle>
              <CardDescription>{content.sessionsDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleRevokeOtherSessions}>
                  {content.revokeOthers}
                </Button>
              </div>

              {profile.sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  {content.noSessions}
                </div>
              ) : null}

              {profile.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    {session.device.toLowerCase().includes("android") ||
                    session.device.toLowerCase().includes("ios") ? (
                      <Smartphone className="mt-1 h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Laptop className="mt-1 h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{session.device}</span>
                        {session.current ? (
                          <Badge>{content.currentSession}</Badge>
                        ) : null}
                        {session.trusted ? (
                          <Badge variant="outline">{content.trustedDevice}</Badge>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.location} · {formatDate(session.lastActiveAt, language)}
                      </div>
                      {session.ipAddress ? (
                        <div className="text-xs text-muted-foreground">
                          IP: {session.ipAddress}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {!session.current ? (
                    <Button
                      variant="outline"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      {content.revoke}
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
