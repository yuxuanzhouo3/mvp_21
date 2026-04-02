import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Pricing } from "@/components/pricing";

export default function PricingPage() {
  return (
    <PublicInfoShell
      badge="Pricing"
      title="Plans that scale from personal use to team collaboration"
      description="Choose a plan based on contract volume, export needs, team permissions, and support expectations."
    >
      <Pricing />
      <CTA />
    </PublicInfoShell>
  );
}
