"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePasswordAction } from "@/actions/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, CheckCircle } from "lucide-react";

function getRegion(): "CN" | "INTL" {
  const region =
    (process.env.NEXT_PUBLIC_DEPLOYMENT_REGION ||
      process.env.NEXT_PUBLIC_APP_REGION ||
      "CN")
      .trim()
      .toUpperCase();
  return region === "INTL" ? "INTL" : "CN";
}

const isIntlRegion = getRegion() === "INTL";
const tx = (zh: string, en: string) => (isIntlRegion ? en : zh);

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(form);
    const result = await changePasswordAction(formData);

    if (result.success) {
      setSuccess(true);
      form.reset();
      if (result.reLoginRequired) {
        setTimeout(() => {
          router.replace("/admin/login");
        }, 800);
      }
    } else {
      setError(result.error || tx("修改失败", "Update failed"));
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tx("系统设置", "System Settings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx("管理管理员账号与安全配置", "Manage admin account and security configuration")}
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>{tx("修改密码", "Change Password")}</CardTitle>
          </div>
          <CardDescription>
            {tx("建议定期更新密码以提升账号安全", "Update your password regularly to improve account security.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {success ? (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {tx("密码修改成功", "Password updated successfully")}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">{tx("当前密码", "Current Password")}</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                placeholder={tx("请输入当前密码", "Enter current password")}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{tx("新密码", "New Password")}</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder={tx(
                  "请输入新密码（至少8位，包含字母和数字）",
                  "Enter a new password (at least 8 chars with letters and numbers)",
                )}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{tx("确认新密码", "Confirm New Password")}</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder={tx("请再次输入新密码", "Re-enter new password")}
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tx("提交中...", "Submitting...")}
                </>
              ) : (
                tx("修改密码", "Update Password")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">{tx("关于", "About")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>{tx("系统版本", "Version")}:</strong> 1.0.0
          </p>
          <p>
            <strong>{tx("数据库", "Database")}:</strong> Supabase (INTL) + CloudBase (CN)
          </p>
          <p>
            <strong>{tx("存储", "Storage")}:</strong> {tx("双端同步存储", "Dual-stack synchronized storage")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
