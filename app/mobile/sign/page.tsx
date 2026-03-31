import { Suspense } from "react";

import { MobileSignature } from "@/components/mobile/mobile-signature";

export default function MobileSignPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <MobileSignature />
      </Suspense>
    </div>
  );
}
