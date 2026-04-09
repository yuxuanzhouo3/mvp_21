import Link from "next/link";
import { FileText } from "lucide-react";

import { ContractSignFlow } from "@/components/contracts/contract-sign-flow";
import { getAppDisplayName } from "@/lib/config/deployment.config";
import { isChinaRegion } from "@/lib/config/region";

interface SignContractPageProps {
  params: Promise<{ id: string }>;
}

export default async function SignContractPage({ params }: SignContractPageProps) {
  const { id } = await params;
  const appName = getAppDisplayName();
  const backLabel = isChinaRegion() ? "返回合同详情" : "Back to Contract";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <nav className="container flex h-16 items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">{appName}</span>
          </Link>
        </nav>
      </header>
      <main className="container px-4 py-8">
        <ContractSignFlow
          contractId={id}
          backHref={`/contracts/${id}?ctx=dashboard`}
          backLabel={backLabel}
          openContractHref={`/contracts/${id}?ctx=dashboard`}
          signatureSource="dashboard-web"
        />
      </main>
    </div>
  );
}
