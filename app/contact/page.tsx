import Link from "next/link";
import { Mail, MessageSquare, Phone } from "lucide-react";

import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const channels = [
  {
    title: "Sales Inquiry",
    description: "For pricing, enterprise plan, and procurement requirements.",
    value: "sales@contracthub.example",
    icon: Mail,
  },
  {
    title: "Product Consultation",
    description: "For workflow setup, migration, and feature guidance.",
    value: "support@contracthub.example",
    icon: MessageSquare,
  },
  {
    title: "Priority Hotline",
    description: "For urgent onboarding and production launch support.",
    value: "+1 (555) 010-2026",
    icon: Phone,
  },
] as const;

export default function ContactPage() {
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
                <p className="text-sm font-medium text-foreground">{channel.value}</p>
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
