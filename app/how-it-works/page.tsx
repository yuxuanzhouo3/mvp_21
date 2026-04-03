import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { HowItWorks } from "@/components/how-it-works";

export default function HowItWorksPage() {
  return (
    <PublicInfoShell
      badge="Workflow"
      title="From source material to a signed and verified contract"
      description="Import chat records or existing drafts, confirm AI analysis, route signers, and keep the final agreement in a governed workflow."
    >
      <HowItWorks />
      <CTA />
    </PublicInfoShell>
  );
}
