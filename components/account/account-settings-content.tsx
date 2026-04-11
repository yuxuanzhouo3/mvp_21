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
import { normalizeAccountProfile } from "@/lib/account/profile";
import { normalizeAvatarSrc } from "@/lib/account/avatar";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { useTranslations } from "@/lib/i18n";
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
  const t = useTranslations(language);
  const content = t.accountSettings;
  const { user: currentUser, loading: userLoading, refreshUser, signOut } = useUser();
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
  }, [content.loadFailed, currentUser, router, setTheme, userLoading]);

  const profileInitial = useMemo(() => {
    const source = profile?.name || profile?.email || currentUser?.email || "U";
    return source.trim().charAt(0).toUpperCase() || "U";
  }, [currentUser?.email, profile?.email, profile?.name]);
  const avatarSrc = useMemo(() => normalizeAvatarSrc(profile?.avatar), [profile?.avatar]);

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
      await refreshUser();
      setSuccess(content.saved);
    } catch (saveError) {
      console.error("[AccountSettings] Failed to save settings:", saveError);
      setError(content.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 6) {
      setError(t.auth.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }

    try {
      setUpdatingPassword(true);
      setError("");
      setSuccess("");

      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        router.push("/auth");
        return;
      }

      headers["Content-Type"] = "application/json";

      const response = await fetch("/api/auth/update", {
        method: "POST",
        headers,
        body: JSON.stringify({
          password: newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update password");
      }

      setNewPassword("");
      setConfirmPassword("");
      setSuccess(content.passwordUpdated);
      window.setTimeout(async () => {
        try {
          await signOut();
        } finally {
          router.replace("/auth");
        }
      }, 900);
    } catch (updateError) {
      console.error("[AccountSettings] Failed to update password:", updateError);
      setError(content.passwordFailed);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
      router.replace("/auth");
    } catch (logoutError) {
      console.error("[AccountSettings] Failed to sign out:", logoutError);
      setError(content.logoutFailed);
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
  const languageLabel = language === "zh" ? content.languageZh : content.languageEn;

  return (
    <div className="space-y-6">
      {isStandalone ? (
        <div className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{content.subtitle}</p>
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
                <AvatarImage src={avatarSrc} alt={profile.name || profile.email} />
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
                <div className="mt-2 font-medium">{languageLabel}</div>
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
                onValueChange={(value) => updatePreference("theme", value as AccountTheme)}
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
                  onCheckedChange={(checked) => updatePreference("notifications", checked)}
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
                  onCheckedChange={(checked) => updatePreference("emailUpdates", checked)}
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
                  onCheckedChange={(checked) => updatePreference("autoSaveDrafts", checked)}
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
                  onCheckedChange={(checked) => updatePreference("contractReminders", checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>{content.password}</CardTitle>
              <CardDescription>{content.passwordDesc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settings-new-password">{content.newPassword}</Label>
                <Input
                  id="settings-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={content.newPasswordPlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-confirm-password">{content.confirmPassword}</Label>
                <Input
                  id="settings-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={content.confirmPasswordPlaceholder}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handlePasswordUpdate} disabled={updatingPassword}>
                  {updatingPassword ? content.updatingPassword : content.updatePassword}
                </Button>
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
