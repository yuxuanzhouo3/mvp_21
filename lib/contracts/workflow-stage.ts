import { normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import type {
  ContractExportSignatures,
} from "@/lib/contracts/export-signatures";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

export type ContractWorkflowStage =
  | "draft"
  | "signing_started"
  | "sender_signed"
  | "completed"
  | "completed_sealed";

export function resolveContractWorkflowStageFromStatuses(
  signFlowStatus?: string,
  sealFlowStatus?: string,
): ContractWorkflowStage {
  if (sealFlowStatus === "sealed" && signFlowStatus === "completed") {
    return "completed_sealed";
  }

  if (signFlowStatus === "completed") {
    return "completed";
  }

  if (signFlowStatus === "awaiting_counterparty") {
    return "sender_signed";
  }

  if (signFlowStatus === "awaiting_sender") {
    return "signing_started";
  }

  return "draft";
}

export function resolveContractWorkflowStage(
  contract: UnifiedContractRecord,
): ContractWorkflowStage {
  const enhancement = normalizeContractEnhancementMeta(contract.metadata, contract);
  return resolveContractWorkflowStageFromStatuses(
    enhancement.signFlow.status,
    enhancement.sealFlow.status,
  );
}

export function resolveContractWorkflowStageForExport(
  signFlowStatus: string | undefined,
  sealFlowStatus: string | undefined,
  signatures: ContractExportSignatures,
): ContractWorkflowStage {
  const statusStage = resolveContractWorkflowStageFromStatuses(
    signFlowStatus,
    sealFlowStatus,
  );

  if (signatures.sender && signatures.counterparty) {
    return statusStage === "completed_sealed" ? "completed_sealed" : "completed";
  }

  if (signatures.sender) {
    return "sender_signed";
  }

  if (signatures.counterparty) {
    return "completed";
  }

  return statusStage;
}

export function getContractWorkflowStageLabel(
  stage: ContractWorkflowStage,
  isEn: boolean,
) {
  if (stage === "signing_started") {
    return isEn ? "Signing Started" : "已发起签署";
  }
  if (stage === "sender_signed") {
    return isEn ? "Sender Signed" : "发起方已签名";
  }
  if (stage === "completed") {
    return isEn ? "Completed" : "已完成";
  }
  if (stage === "completed_sealed") {
    return isEn ? "Completed + Sealed" : "已完成+已盖章";
  }

  return isEn ? "Draft" : "草稿";
}

export function filterContractExportSignaturesByStage(
  signatures: ContractExportSignatures,
  stage: ContractWorkflowStage,
): ContractExportSignatures {
  if (stage === "draft" || stage === "signing_started") {
    return {};
  }

  if (stage === "sender_signed") {
    return {
      sender: signatures.sender,
    };
  }

  return {
    sender: signatures.sender,
    counterparty: signatures.counterparty,
  };
}
