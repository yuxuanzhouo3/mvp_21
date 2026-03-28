"use client";

import { AccountSettingsContent } from "@/components/account/account-settings-content";
import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { useTranslations } from "@/lib/i18n";

export default function DashboardSettingsPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const labels = t.platform?.consoleModules || {
    overview: language === "en" ? "Overview" : "总览",
    settings: language === "en" ? "Settings" : "设置",
  };

  const content =
    language === "zh"
      ? {
          title: "账户设置",
          description: "管理账号偏好、主题、通知和退出登录等基础配置。",
        }
      : {
          title: "Account Settings",
          description:
            "Manage account preferences, theme, notifications, and core sign-out controls.",
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
      <AccountSettingsContent mode="dashboard" />
    </ConsoleShell>
  );
}
