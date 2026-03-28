import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { AppProvider } from "@/components/app-context";
import { LanguageProvider } from "@/components/language-provider";
import { UserProvider } from "@/components/user-context";
import {
  getAppDisplayName,
  getDefaultLanguage,
} from "@/lib/config/deployment.config";
import "./globals.css";

const appName = getAppDisplayName();
const defaultLanguage = getDefaultLanguage();
const metadataDescription =
  defaultLanguage === "zh"
    ? "面向合作双方的电子合同平台，支持合同拟定、在线确认、电子签署与长期留存。"
    : "A digital contract platform for drafting, confirming, signing, and reviewing agreements online.";

export const metadata: Metadata = {
  title: `${appName} - Digital Contract Platform`,
  description: metadataDescription,
  keywords: [
    "contract",
    "e-signature",
    "digital contracts",
    "China",
    "USA",
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
        <UserProvider>
          <LanguageProvider>
            <AppProvider>{children}</AppProvider>
          </LanguageProvider>
        </UserProvider>
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  );
}
