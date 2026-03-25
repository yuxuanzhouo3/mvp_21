import { CTA } from "@/components/cta";
import { Features } from "@/components/features";
import { PublicInfoShell } from "@/components/layout/public-info-shell";

export default function FeaturesPage() {
  return (
    <PublicInfoShell>
      <Features />
      <CTA />
    </PublicInfoShell>
  );
}
