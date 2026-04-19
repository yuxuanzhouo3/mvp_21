import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireMarketAdminSession } from "../require-market-session";
import { AcquisitionClient } from "./acquisition-client";
import { resolveDeploymentRegion } from "@/lib/config/deployment-region";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MarketAcquisitionPage() {
  await requireMarketAdminSession();
  const isIntlRegion = resolveDeploymentRegion() === "INTL";

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-4 md:px-8 md:py-6">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <div className="flex items-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/market">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isIntlRegion ? "Back to System Navigation" : "返回系统导航"}
            </Link>
          </Button>
        </div>

        <AcquisitionClient />
      </div>
    </div>
  );
}
