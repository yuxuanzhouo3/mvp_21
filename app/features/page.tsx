import { CTA } from "@/components/cta";
import { Features } from "@/components/features";
import { PublicInfoShell } from "@/components/layout/public-info-shell";

export default function FeaturesPage() {
  return (
    <PublicInfoShell
      badge="MornContract"
      title="Core capabilities for drafting, signing, governing, and retaining contracts"
      description="One production-ready workspace for template-driven drafting, AI analysis, signer coordination, document verification, and long-term record retention."
    >
      <Features />
      <CTA />
    </PublicInfoShell>
  );
}
