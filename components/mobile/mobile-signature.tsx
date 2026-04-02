"use client";

import { useSearchParams } from "next/navigation";

import { ContractSignFlow } from "@/components/contracts/contract-sign-flow";

export function MobileSignature() {
  const searchParams = useSearchParams();
  const contractId = searchParams.get("contractId");

  return (
    <ContractSignFlow
      contractId={contractId}
      backHref="/mobile/contracts"
      openContractHref={contractId ? `/contracts/${contractId}?ctx=mobile` : "/mobile/contracts"}
      signatureSource="mobile"
    />
  );
}
