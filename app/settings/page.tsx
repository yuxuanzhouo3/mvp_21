"use client";

import { Header } from "@/components/header";
import { AccountSettingsContent } from "@/components/account/account-settings-content";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <AccountSettingsContent mode="standalone" />
      </main>
    </div>
  );
}
