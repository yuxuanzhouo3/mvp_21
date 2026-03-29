"use client";

import { AccountSettingsContent } from "@/components/account/account-settings-content";
import { useLanguage } from "@/components/language-provider";
import { ConsoleShell } from "@/components/layout/console-shell";
import { useTranslations } from "@/lib/i18n";

export default function DashboardSettingsPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const labels = t.platform.consoleModules;
  const content = t.accountSettings;

  return (
    <ConsoleShell
      crumbs={[
        { label: labels.overview, href: "/dashboard" },
        { label: labels.settings },
      ]}
      title={content.title}
      description={content.subtitle}
    >
      <AccountSettingsContent mode="dashboard" />
    </ConsoleShell>
  );
}
