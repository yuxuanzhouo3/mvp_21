import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { HowItWorks } from "@/components/how-it-works";

export default function HowItWorksPage() {
  return (
    <PublicInfoShell
      badge="Workflow"
      title="From conversation records to a signed contract"
      description="Import source material, confirm AI analysis, route signers, and keep the final document in one managed workflow."
    >
      <HowItWorks />
      <CTA />
    </PublicInfoShell>
  );
}
