import Link from "next/link";
import { Mail, MessageSquare, Phone } from "lucide-react";

import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadAdminSettings } from "@/lib/data/admin-settings-store";

export default async function ContactPage() {
  const settings = await loadAdminSettings();
  const channels = [
    {
      title: "Sales Inquiry",
      description: "For pricing, enterprise plan, and procurement requirements.",
      value: settings.general.salesEmail,
      href: `mailto:${settings.general.salesEmail}`,
      icon: Mail,
    },
    {
      title: "Product Consultation",
      description: "For workflow setup, migration, and feature guidance.",
      value: settings.general.supportEmail,
      href: `mailto:${settings.general.supportEmail}`,
      icon: MessageSquare,
    },
    {
      title: "Priority Hotline",
      description: "For urgent onboarding and production launch support.",
      value: settings.general.hotline,
      href: `tel:${settings.general.hotline.replace(/\s+/g, "")}`,
      icon: Phone,
    },
  ] as const;

  return (
    <PublicInfoShell>
      <section className="mx-auto w-full max-w-7xl px-4 pt-10 md:pt-12">
        <div className="grid gap-4 md:grid-cols-3">
          {channels.map((channel) => (
            <Card key={channel.title} className="border-border/70 bg-card/95">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <channel.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{channel.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{channel.description}</p>
                <a
                  href={channel.href}
                  className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {channel.value}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Prefer self-service? Go to{" "}
          <Link href="/pricing" className="text-primary underline">
            Pricing
          </Link>{" "}
          or{" "}
          <Link href="/create" className="text-primary underline">
            Create Contract
          </Link>
          .
        </p>
      </section>
    </PublicInfoShell>
  );
}
