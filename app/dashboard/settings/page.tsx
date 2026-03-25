"use client";

import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/lib/i18n";

export default function SettingsPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    settings: language === "en" ? "Settings" : "设置",
  };

  const content = t.pages?.settings || {
    title: language === "en" ? "Settings" : "设置",
    description:
      language === "en"
        ? "Manage your account settings and preferences."
        : "管理账户设置与偏好选项。",
    profileInformation: language === "en" ? "Profile Information" : "个人资料",
    profileDescription:
      language === "en" ? "Update your personal information" : "更新你的个人资料信息",
    name: language === "en" ? "Name" : "姓名",
    namePlaceholder: language === "en" ? "Your name" : "请输入你的姓名",
    email: language === "en" ? "Email" : "邮箱",
    emailPlaceholder: language === "en" ? "your@email.com" : "请输入邮箱地址",
    saveChanges: language === "en" ? "Save Changes" : "保存修改",
    preferences: language === "en" ? "Preferences" : "偏好设置",
    preferencesDescription:
      language === "en" ? "Customize your experience" : "自定义你的工作体验",
    emailNotifications: language === "en" ? "Email Notifications" : "邮件通知",
    emailNotificationsDescription:
      language === "en"
        ? "Receive email updates about your contracts"
        : "接收合同状态更新邮件",
    autoSaveDrafts: language === "en" ? "Auto-save Drafts" : "自动保存草稿",
    autoSaveDraftsDescription:
      language === "en"
        ? "Automatically save contract drafts"
        : "自动保存合同编辑草稿",
  };

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.settings },
      ]}
      title={content.title}
      description={content.description}
    >
      <div className="max-w-2xl space-y-6">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>{content.profileInformation}</CardTitle>
            <CardDescription>{content.profileDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{content.name}</Label>
              <Input id="name" name="name" placeholder={content.namePlaceholder} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{content.email}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={content.emailPlaceholder}
              />
            </div>
            <Button className="w-full sm:w-auto">{content.saveChanges}</Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>{content.preferences}</CardTitle>
            <CardDescription>{content.preferencesDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>{content.emailNotifications}</Label>
                <p className="text-sm text-muted-foreground">{content.emailNotificationsDescription}</p>
              </div>
              <Switch className="self-start sm:self-auto" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>{content.autoSaveDrafts}</Label>
                <p className="text-sm text-muted-foreground">{content.autoSaveDraftsDescription}</p>
              </div>
              <Switch defaultChecked className="self-start sm:self-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    </ConsoleShell>
  );
}
