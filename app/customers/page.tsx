import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Testimonials } from "@/components/testimonials";

export default function CustomersPage() {
  return (
    <PublicInfoShell
      badge="Use Cases"
      title="Teams using structured contract workflows"
      description="Common operating patterns for service teams, supplier management, and internal approval flows across regions."
    >
      <Testimonials />
      <CTA />
    </PublicInfoShell>
  );
}
