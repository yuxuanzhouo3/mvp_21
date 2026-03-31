import { describe, expect, test } from "@jest/globals";

import { applyContractAction, normalizeContractEnhancementMeta } from "@/lib/contracts/enhancements";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

function buildContract(): UnifiedContractRecord {
  return {
    id: "contract-test-1",
    userId: "user-1",
    title: "Service Agreement",
    type: "service",
    status: "draft",
    content: {
      summary: "A sample agreement for testing.",
    },
    parties: [
      { name: "Acme Ltd." },
      { name: "Beta LLC" },
    ],
    signatures: [],
    metadata: {},
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
  };
}

describe("contract sign flow mainline coverage", () => {
  test("mobile signing flow actions retain reminders, confirmations, and final copy evidence", () => {
    const draft = buildContract();

    const started = applyContractAction(draft, "start_signing", "Tester");
    const startedEnhancement = normalizeContractEnhancementMeta(started.metadata, {
      ...draft,
      status: started.status,
      metadata: started.metadata,
    });
    expect(started.status).toBe("pending");
    expect(startedEnhancement.signFlow.status).toBe("awaiting_sender");

    const senderConfirmed = applyContractAction(
      {
        ...draft,
        status: started.status,
        metadata: started.metadata,
      },
      "confirm_sender",
      "Tester",
    );
    const senderEnhancement = normalizeContractEnhancementMeta(senderConfirmed.metadata, {
      ...draft,
      status: senderConfirmed.status,
      metadata: senderConfirmed.metadata,
    });
    expect(senderEnhancement.signFlow.status).toBe("awaiting_counterparty");
    expect(senderEnhancement.signFlow.participants[0]?.status).toBe("confirmed");

    const reminded = applyContractAction(
      {
        ...draft,
        status: senderConfirmed.status,
        metadata: senderConfirmed.metadata,
      },
      "send_reminder",
      "Tester",
      "Reminder from mobile",
    );
    const remindedEnhancement = normalizeContractEnhancementMeta(reminded.metadata, {
      ...draft,
      status: reminded.status,
      metadata: reminded.metadata,
    });
    expect(remindedEnhancement.signFlow.reminderCount).toBe(1);
    expect(remindedEnhancement.signFlow.evidence.some((item) => item.type === "reminder")).toBe(true);

    const completed = applyContractAction(
      {
        ...draft,
        status: reminded.status,
        metadata: reminded.metadata,
      },
      "confirm_counterparty",
      "Tester",
    );
    const completedEnhancement = normalizeContractEnhancementMeta(completed.metadata, {
      ...draft,
      status: completed.status,
      metadata: completed.metadata,
    });

    expect(completed.status).toBe("completed");
    expect(completedEnhancement.signFlow.status).toBe("completed");
    expect(completedEnhancement.signFlow.participants.every((item) => item.status === "confirmed")).toBe(true);
    expect(completedEnhancement.signFlow.finalCopy?.filename).toContain("Service Agreement");
    expect(
      completedEnhancement.signFlow.evidence.some((item) => item.type === "final_copy"),
    ).toBe(true);
  });
});
