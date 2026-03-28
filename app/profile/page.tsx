"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  LogOut,
  Mail,
  Phone,
  Save,
  Settings,
  User,
} from "lucide-react";

import { normalizeAccountProfile, type AccountProfile } from "@/lib/account/profile";
import { Header } from "@/components/header";
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

export default function ProfilePage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user: currentUser, loading: userLoading, refreshUser, signOut } = useUser();
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
            title: "个人资料",
            subtitle: "完善头像、姓名和联系方式，方便双方在签署合同前确认身份。",
            loading: "正在加载资料...",
            loginRequired: "请先登录后再查看个人资料。",
            loginAction: "前往登录",
            back: "返回",
            name: "姓名",
            namePlaceholder: "请输入您的姓名或企业联系人称呼",
            email: "邮箱",
            avatar: "头像 URL",
            avatarPlaceholder: "请输入头像图片地址",
            phone: "联系电话",
            phonePlaceholder: "请输入联系电话",
            membership: "会员状态",
            membershipNone: "未开通会员",
            save: "保存资料",
            saving: "保存中...",
            saved: "个人资料已更新",
            loadFailed: "加载个人资料失败，请稍后重试。",
            saveFailed: "保存失败，请稍后重试。",
            settings: "设置",
            billing: "账单与会员",
            logout: "退出登录",
            free: "免费版",
            active: "生效中",
            inactive: "未开通",
          }
        : {
            title: "Profile",
            subtitle:
              "Complete your avatar, name, and contact details before contracts are shared for signature.",
            loading: "Loading profile...",
            loginRequired: "Please sign in before viewing your profile.",
            loginAction: "Go to Sign In",
            back: "Back",
            name: "Full Name",
            namePlaceholder: "Enter your name or primary contact",
            email: "Email",
            avatar: "Avatar URL",
            avatarPlaceholder: "Enter an avatar image URL",
            phone: "Phone",
            phonePlaceholder: "Enter a contact phone number",
            membership: "Membership",
            membershipNone: "No active membership",
            save: "Save Profile",
            saving: "Saving...",
            saved: "Profile updated",
            loadFailed: "Failed to load profile. Please try again later.",
            saveFailed: "Failed to save profile. Please try again later.",
            settings: "Settings",
            billing: "Billing",
            logout: "Log out",
            free: "Free plan",
            active: "Active",
            inactive: "Inactive",
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

        if (!cancelled) {
          setProfile(normalizeAccountProfile(await response.json()));
        }
      } catch (loadError) {
        console.error("[ProfilePage] Failed to load profile:", loadError);
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
  }, [content.loadFailed, currentUser, router, userLoading]);

  const profileInitial = useMemo(() => {
    const source = profile?.name || profile?.email || currentUser?.email || "U";
    return source.trim().charAt(0).toUpperCase() || "U";
  }, [currentUser?.email, profile?.email, profile?.name]);

  const handleChange = (field: keyof Pick<AccountProfile, "name" | "avatar" | "phone">, value: string) => {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
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
          name: profile.name.trim(),
          avatar: profile.avatar.trim(),
          phone: profile.phone.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      const nextProfile = normalizeAccountProfile(await response.json());
      setProfile(nextProfile);
      await refreshUser();
      setSuccess(content.saved);
    } catch (saveError) {
      console.error("[ProfilePage] Failed to save profile:", saveError);
      setError(content.saveFailed);
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
      console.error("[ProfilePage] Failed to sign out:", logoutError);
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
      <div className="min-h-screen bg-muted/20">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-muted-foreground">{content.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser || !profile) {
    return (
      <div className="min-h-screen bg-muted/20">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
          <Card>
            <CardHeader>
              <CardTitle>{content.title}</CardTitle>
              <CardDescription>{content.loginRequired}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/auth")}>{content.loginAction}</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const membershipLabel =
    profile.subscription_status === "active" ? content.active : content.inactive;
  const planLabel =
    profile.subscription_plan === "pro"
      ? "Pro"
      : profile.subscription_plan === "enterprise"
        ? "Enterprise"
        : content.free;

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {content.back}
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {content.title}
              </CardTitle>
              <CardDescription>{content.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar} alt={profile.name || profile.email} />
                  <AvatarFallback className="text-lg">{profileInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">
                    {profile.name || profile.email}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {profile.email}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{planLabel}</Badge>
                    <Badge variant="outline">{membershipLabel}</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                <div className="text-sm font-medium">{content.membership}</div>
                <div className="text-sm text-muted-foreground">
                  {profile.membership_expires_at
                    ? new Date(profile.membership_expires_at).toLocaleDateString(
                        language === "zh" ? "zh-CN" : "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )
                    : content.membershipNone}
                </div>
              </div>

              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => router.push("/settings")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  {content.settings}
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

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>{content.title}</CardTitle>
              <CardDescription>{content.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {success ? (
                <Alert>
                  <AlertDescription className="text-green-600">
                    {success}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="profile-name">{content.name}</Label>
                <Input
                  id="profile-name"
                  value={profile.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder={content.namePlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">{content.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-avatar">{content.avatar}</Label>
                <Input
                  id="profile-avatar"
                  value={profile.avatar}
                  onChange={(event) => handleChange("avatar", event.target.value)}
                  placeholder={content.avatarPlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">{content.phone}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="profile-phone"
                    value={profile.phone}
                    onChange={(event) => handleChange("phone", event.target.value)}
                    placeholder={content.phonePlaceholder}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex justify-end">
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
