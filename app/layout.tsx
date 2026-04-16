import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";

import { AppProvider } from "@/components/app-context";
import { LanguageProvider } from "@/components/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/components/user-context";
import { assertProductionJwtConfiguration } from "@/lib/auth/jwt";
import {
  getAppDisplayName,
  getDefaultLanguage,
} from "@/lib/config/deployment.config";
import "@/lib/monitoring/startup-checks";
import "./globals.css";

assertProductionJwtConfiguration();

const appName = getAppDisplayName();
const defaultLanguage = getDefaultLanguage();
const enableVercelAnalytics =
  process.env.VERCEL === "1" ||
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true";
const metadataDescription =
  defaultLanguage === "zh"
    ? "面向合作双方的数字合同平台，支持合同生成、在线确认、电子签署与长期留存。"
    : "A digital contract platform for drafting, confirming, signing, and reviewing agreements online.";

export const metadata: Metadata = {
  title: `${appName} - Digital Contract Platform`,
  description: metadataDescription,
  keywords: [
    "contract",
    "e-signature",
    "digital contracts",
    "China",
    "international",
    "MornContract",
  ],
  authors: [{ name: appName }],
  generator: "Next.js",
  openGraph: {
    title: `${appName} - Digital Contract Platform`,
    description: metadataDescription,
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={defaultLanguage} suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <UserProvider>
            <LanguageProvider>
              <AppProvider>{children}</AppProvider>
            </LanguageProvider>
          </UserProvider>
        </ThemeProvider>
        <Toaster position="top-center" richColors />
        {enableVercelAnalytics ? <Analytics /> : null}
      </body>
    </html>
  );
}

