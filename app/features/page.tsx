import { CTA } from "@/components/cta";
import { Features } from "@/components/features";
import { PublicInfoShell } from "@/components/layout/public-info-shell";

export default function FeaturesPage() {
  return (
    <PublicInfoShell
      badge="Platform"
      title="Core capabilities for drafting, signing, and retaining contracts"
      description="A single workspace for template-based drafting, AI-assisted generation, signer coordination, and long-term document retention."
    >
      <Features />
      <CTA />
    </PublicInfoShell>
  );
}
