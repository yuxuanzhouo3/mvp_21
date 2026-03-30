"use client";

import { Header } from "@/components/header";
import { AccountControlCenter } from "@/components/account/account-control-center";

export default function SecuritySettingsPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <AccountControlCenter defaultTab="security" />
      </main>
    </div>
  );
}
