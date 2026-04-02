import { describe, expect, test } from "@jest/globals";

import {
  appendContractUpdateLog,
  applyContractAction,
  normalizeContractEnhancementMeta,
} from "@/lib/contracts/enhancements";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

function buildContract(): UnifiedContractRecord {
  return {
    id: "contract-edge-1",
    userId: "user-1",
    title: "Edge Case Agreement",
    type: "service",
    status: "draft",
    content: {
      summary: "Edge case contract for test coverage.",
    },
    parties: [
      { name: "Sender Ltd." },
      { name: "Counterparty LLC" },
    ],
    signatures: [],
    metadata: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

describe("contract sign flow edge coverage", () => {
  test("archive and unarchive actions keep sign flow state while recording audit evidence", () => {
    const draft = buildContract();

    const started = applyContractAction(draft, "start_signing", "Tester");
    const archived = applyContractAction(
      {
        ...draft,
        status: started.status,
        metadata: started.metadata,
      },
      "archive",
      "Tester",
      "Archive after handoff",
    );
    const archivedEnhancement = normalizeContractEnhancementMeta(archived.metadata, {
      ...draft,
      status: archived.status,
      metadata: archived.metadata,
    });

    expect(archivedEnhancement.archivedAt).toBeDefined();
    expect(archivedEnhancement.archivedReason).toBe("Archive after handoff");
    expect(archivedEnhancement.signFlow.status).toBe("awaiting_sender");
    expect(archivedEnhancement.signFlow.evidence.some((item) => item.type === "archive")).toBe(
      true,
    );

    const restored = applyContractAction(
      {
        ...draft,
        status: archived.status,
        metadata: archived.metadata,
      },
      "unarchive",
      "Tester",
    );
    const restoredEnhancement = normalizeContractEnhancementMeta(restored.metadata, {
      ...draft,
      status: restored.status,
      metadata: restored.metadata,
    });

    expect(restoredEnhancement.archivedAt).toBeUndefined();
    expect(restoredEnhancement.archivedReason).toBeUndefined();
    expect(restoredEnhancement.signFlow.status).toBe("awaiting_sender");
    expect(
      restoredEnhancement.operationLogs.some((entry) => entry.action === "unarchived"),
    ).toBe(true);
  });

  test("appendContractUpdateLog preserves sign flow metadata while prepending the newest update log", () => {
    const draft = buildContract();
    const started = applyContractAction(draft, "start_signing", "Tester");
    const reminded = applyContractAction(
      {
        ...draft,
        status: started.status,
        metadata: started.metadata,
      },
      "send_reminder",
      "Tester",
      "Reminder before update",
    );

    const metadataWithUpdate = appendContractUpdateLog(
      {
        ...draft,
        status: reminded.status,
        metadata: reminded.metadata,
      },
      "Tester",
      "Updated summary field",
    );
    const enhancement = normalizeContractEnhancementMeta(metadataWithUpdate, {
      ...draft,
      status: reminded.status,
      metadata: metadataWithUpdate,
    });

    expect(enhancement.signFlow.status).toBe("awaiting_sender");
    expect(enhancement.signFlow.reminderCount).toBe(1);
    expect(enhancement.operationLogs[0]?.action).toBe("updated");
    expect(enhancement.operationLogs[0]?.description).toBe("Updated summary field");
  });
});
