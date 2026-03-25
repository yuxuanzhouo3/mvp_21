import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { HowItWorks } from "@/components/how-it-works";

export default function HowItWorksPage() {
  return (
    <PublicInfoShell>
      <HowItWorks />
      <CTA />
    </PublicInfoShell>
  );
}
