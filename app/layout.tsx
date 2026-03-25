import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/components/language-provider";
import { UserProvider } from "@/components/user-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContractHub - Digital Contracts Platform",
  description:
    "Create, sign, and manage legally binding contracts across borders. Trusted by businesses in China and the United States.",
  keywords: [
    "contract",
    "e-signature",
    "digital contracts",
    "China",
    "USA",
    "ContractHub",
  ],
  authors: [{ name: "ContractHub" }],
  generator: "Next.js",
  openGraph: {
    title: "ContractHub - Digital Contracts Platform",
    description:
      "Create, sign, and manage legally binding contracts across borders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <UserProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </UserProvider>
        <Toaster position="top-center" richColors />
        <Analytics />
      </body>
    </html>
  );
}
