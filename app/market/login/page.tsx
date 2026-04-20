"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isChinaRegion } from "@/lib/config/region";

function getRegion(): "CN" | "INTL" {
  return isChinaRegion() ? "CN" : "INTL";
}

const isIntlRegion = getRegion() === "INTL";

const copy = {
  title: isIntlRegion ? "Marketing Console Login" : "营销系统后台登录",
  subtitle: isIntlRegion
    ? "Sign in to access analytics, acquisition, notifications, and fission modules."
    : "登录后可进入用户分析、获客、通知和裂变子系统。",
  accountLabel: isIntlRegion ? "Email / Username" : "账号",
  accountPlaceholder: isIntlRegion ? "Enter your email or username" : "请输入账号",
  passwordLabel: isIntlRegion ? "Password" : "密码",
  passwordPlaceholder: isIntlRegion ? "Enter your password" : "请输入密码",
  submit: isIntlRegion ? "Sign in" : "登录",
  submitting: isIntlRegion ? "Signing in..." : "登录中...",
  defaultError: isIntlRegion ? "Login failed" : "登录失败",
};

export default function MarketLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState(isIntlRegion ? "" : "admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitDisabled = useMemo(() => loading, [loading]);

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/market/auth/session", { cache: "no-store" });
      if (response.ok) {
        router.replace("/market");
      }
    };

    void run();
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/market/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || copy.defaultError);
      }

      router.replace("/market");
    } catch (err: any) {
      setError(err?.message || copy.defaultError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>

        <div className="space-y-2">
          <Label>{copy.accountLabel}</Label>
          <Input
            value={username}
            placeholder={copy.accountPlaceholder}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{copy.passwordLabel}</Label>
          <Input
            type="password"
            value={password}
            placeholder={copy.passwordPlaceholder}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitDisabled}>
          {loading ? copy.submitting : copy.submit}
        </Button>
      </form>
    </div>
  );
}
