"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  ImagePlus,
  LogOut,
  Mail,
  Phone,
  Save,
  Settings,
  User,
} from "lucide-react";

import { normalizeAccountProfile, type AccountProfile } from "@/lib/account/profile";
import { normalizeAvatarSrc } from "@/lib/account/avatar";
import { Header } from "@/components/header";
import { useLanguage } from "@/components/language-provider";
import { useUser } from "@/components/user-context";
import { useTranslations } from "@/lib/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MembershipStatusCard } from "@/components/account/membership-status-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function ProfilePage() {
  const router = useRouter();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const content = t.profilePage;
  const { user: currentUser, loading: userLoading, refreshUser, signOut } = useUser();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
  const avatarSrc = useMemo(() => normalizeAvatarSrc(profile?.avatar), [profile?.avatar]);

  const handleChange = (
    field: keyof Pick<AccountProfile, "name" | "avatar" | "phone">,
    value: string,
  ) => {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const avatar = await compressAvatar(file);
      handleChange("avatar", avatar);
    } catch (uploadError) {
      console.error("[ProfilePage] Failed to process avatar:", uploadError);
      setError(content.saveFailed);
    } finally {
      event.target.value = "";
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
      setError(content.logoutFailed);
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
                  <AvatarImage src={avatarSrc} alt={profile.name || profile.email} />
                  <AvatarFallback className="text-lg">{profileInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">
                    {profile.name || profile.email}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {profile.email}
                  </div>
                  <div className="mt-2">
                    <Label
                      htmlFor="profile-avatar-upload"
                      className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {content.avatar}
                    </Label>
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                  </div>
                </div>
              </div>

              <MembershipStatusCard
                plan={profile.subscription_plan}
                status={profile.subscription_status}
                expiresAt={profile.membership_expires_at || profile.subscription_expires_at}
                language={language}
              />

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
