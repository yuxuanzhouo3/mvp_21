import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Pricing } from "@/components/pricing";

export default function PricingPage() {
  return (
    <PublicInfoShell>
      <Pricing />
      <CTA />
    </PublicInfoShell>
  );
}
