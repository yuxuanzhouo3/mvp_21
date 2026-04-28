import { describe, expect, test } from "@jest/globals";

import {
  applyContractAction,
  applyContractSeal,
  canSealContract,
  normalizeContractEnhancementMeta,
} from "@/lib/contracts/enhancements";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

function buildContract(): UnifiedContractRecord {
  return {
    id: "contract-seal-1",
    userId: "user-1",
    title: "Seal Mainline Contract",
    type: "service",
    status: "draft",
    content: {
      summary: "Seal flow regression coverage",
    },
    parties: [{ name: "Sender Co" }, { name: "Counterparty Co" }],
    signatures: [],
    metadata: {},
    createdAt: "2026-04-18T00:00:00.000Z",
    updatedAt: "2026-04-18T00:00:00.000Z",
  };
}

describe("contract seal flow", () => {
  test("only completed signing contracts can be sealed", () => {
    const draft = buildContract();
    expect(canSealContract(draft)).toBe(false);

    const started = applyContractAction(draft, "start_signing", "Tester");
    const awaiting = {
      ...draft,
      status: started.status,
      metadata: started.metadata,
    };
    expect(canSealContract(awaiting)).toBe(false);

    const sender = applyContractAction(awaiting, "confirm_sender", "Tester");
    const awaitingCounterparty = {
      ...awaiting,
      status: sender.status,
      metadata: sender.metadata,
    };
    expect(canSealContract(awaitingCounterparty)).toBe(false);

    const completed = applyContractAction(awaitingCounterparty, "confirm_counterparty", "Tester");
    const completedContract = {
      ...awaitingCounterparty,
      status: completed.status,
      metadata: completed.metadata,
    };
    expect(canSealContract(completedContract)).toBe(true);
  });

  test("applyContractSeal persists seal metadata and evidence", () => {
    const draft = buildContract();
    const started = applyContractAction(draft, "start_signing", "Tester");
    const sender = applyContractAction(
      { ...draft, status: started.status, metadata: started.metadata },
      "confirm_sender",
      "Tester",
    );
    const completed = applyContractAction(
      { ...draft, status: sender.status, metadata: sender.metadata },
      "confirm_counterparty",
      "Tester",
    );
    const completedContract = {
      ...draft,
      status: completed.status,
      metadata: completed.metadata,
    };

    const sealed = applyContractSeal(completedContract, {
      actor: "Seal Tester",
      note: "Official seal applied",
      stamp: {
        imageDataUrl:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pbdmLQAAAAASUVORK5CYII=",
        imageMimeType: "image/png",
        fileName: "company-seal.png",
        source: "unit-test",
      },
      placement: {
        page: 1,
        x: 420,
        y: 90,
        width: 120,
        height: 120,
        opacity: 0.9,
      },
    });

    const enhancement = normalizeContractEnhancementMeta(sealed.metadata, {
      ...completedContract,
      metadata: sealed.metadata,
    });

    expect(enhancement.sealFlow.status).toBe("sealed");
    expect(enhancement.sealFlow.version).toBe(1);
    expect(enhancement.sealFlow.stampedBy).toBe("Seal Tester");
    expect(enhancement.sealFlow.outputs?.variant).toBe("sealed");
    expect(enhancement.sealFlow.stamp?.fileName).toBe("company-seal.png");
    expect(enhancement.sealFlow.evidence.some((item) => item.type === "seal")).toBe(true);
    expect(enhancement.signFlow.evidence.some((item) => item.type === "seal")).toBe(true);
    expect(enhancement.operationLogs.some((log) => log.action === "sealed")).toBe(true);
  });
});
