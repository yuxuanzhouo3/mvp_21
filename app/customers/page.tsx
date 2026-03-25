import { CTA } from "@/components/cta";
import { PublicInfoShell } from "@/components/layout/public-info-shell";
import { Testimonials } from "@/components/testimonials";

export default function CustomersPage() {
  return (
    <PublicInfoShell>
      <Testimonials />
      <CTA />
    </PublicInfoShell>
  );
}
