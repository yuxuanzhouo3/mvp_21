"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLoginAction } from "@/actions/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, User } from "lucide-react";
import { isChinaRegion } from "@/lib/config/region";

function getRegion(): "CN" | "INTL" {
  return isChinaRegion() ? "CN" : "INTL";
}

const isIntlRegion = getRegion() === "INTL";

const copy = {
  title: isIntlRegion ? "Admin Console" : "管理后台",
  subtitle: isIntlRegion
    ? "Sign in with your administrator account."
    : "请输入管理员账号密码登录",
  usernameLabel: isIntlRegion ? "Username" : "用户名",
  usernamePlaceholder: isIntlRegion ? "Enter username" : "请输入用户名",
  passwordLabel: isIntlRegion ? "Password" : "密码",
  passwordPlaceholder: isIntlRegion ? "Enter password" : "请输入密码",
  submit: isIntlRegion ? "Sign in" : "登录",
  submitting: isIntlRegion ? "Signing in..." : "登录中...",
  defaultError: isIntlRegion ? "Login failed" : "登录失败",
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const submitDisabled = useMemo(() => loading, [loading]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/admin/check-auth", {
          credentials: "include",
        });

        if (response.ok) {
          router.replace("/admin/dashboard");
          return;
        }
      } catch {
        // Ignore check failures and keep login page available.
      } finally {
        setChecking(false);
      }
    }

    void checkAuth();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await adminLoginAction(formData);

    if (result.success) {
      router.push("/admin/dashboard");
      router.refresh();
      return;
    }

    setError(result.error || copy.defaultError);
    setLoading(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">{copy.title}</CardTitle>
          <CardDescription>{copy.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="username">{copy.usernameLabel}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder={copy.usernamePlaceholder}
                  className="pl-10"
                  required
                  disabled={submitDisabled}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{copy.passwordLabel}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={copy.passwordPlaceholder}
                  className="pl-10"
                  required
                  disabled={submitDisabled}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitDisabled}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {copy.submitting}
                </>
              ) : (
                copy.submit
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
