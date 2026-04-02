import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AIContractIntakeScreen } from "@/components/create/ai-contract-intake-screen";

export default function CreateAIChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AIContractIntakeScreen />
    </Suspense>
  );
}
