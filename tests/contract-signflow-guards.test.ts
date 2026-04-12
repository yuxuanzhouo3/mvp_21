import { describe, expect, test } from "@jest/globals";

import {
  applyContractAction,
  getAvailableContractActions,
  validateContractAction,
} from "@/lib/contracts/enhancements";
import type { UnifiedContractRecord } from "@/lib/data/unified-models";

function buildContract(): UnifiedContractRecord {
  return {
    id: "contract-guard-1",
    userId: "user-1",
    title: "Guard Contract",
    type: "service",
    status: "draft",
    content: { summary: "Guard flow coverage" },
    parties: [{ name: "Sender Ltd." }, { name: "Counterparty LLC" }],
    signatures: [],
    metadata: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function applyAndMerge(
  contract: UnifiedContractRecord,
  action:
    | "archive"
    | "unarchive"
    | "start_signing"
    | "confirm_sender"
    | "confirm_counterparty"
    | "send_reminder",
) {
  const result = applyContractAction(contract, action, "Tester");
  return {
    ...contract,
    status: result.status,
    metadata: result.metadata,
  };
}

describe("contract sign flow guard coverage", () => {
  test("draft contract only allows archive and start signing", () => {
    const draft = buildContract();

    expect(getAvailableContractActions(draft)).toEqual(["archive", "start_signing"]);
    expect(validateContractAction(draft, "start_signing")).toEqual({ allowed: true });
    expect(validateContractAction(draft, "confirm_sender")).toEqual({
      allowed: false,
      code: "SIGNFLOW_INVALID_SENDER_STEP",
    });
    expect(validateContractAction(draft, "confirm_counterparty")).toEqual({
      allowed: false,
      code: "SIGNFLOW_INVALID_COUNTERPARTY_STEP",
    });
    expect(validateContractAction(draft, "send_reminder")).toEqual({
      allowed: false,
      code: "SIGNFLOW_INVALID_REMINDER_STEP",
    });
  });

  test("state transitions expose only the next valid signing actions", () => {
    const draft = buildContract();
    const started = applyAndMerge(draft, "start_signing");
    const senderConfirmed = applyAndMerge(started, "confirm_sender");
    const completed = applyAndMerge(senderConfirmed, "confirm_counterparty");

    expect(getAvailableContractActions(started)).toEqual(["archive", "confirm_sender", "send_reminder"]);
    expect(validateContractAction(started, "start_signing")).toEqual({
      allowed: false,
      code: "SIGNFLOW_ALREADY_STARTED",
    });

    expect(getAvailableContractActions(senderConfirmed)).toEqual([
      "archive",
      "confirm_counterparty",
      "send_reminder",
    ]);
    expect(validateContractAction(senderConfirmed, "confirm_sender")).toEqual({
      allowed: false,
      code: "SIGNFLOW_INVALID_SENDER_STEP",
    });

    expect(getAvailableContractActions(completed)).toEqual(["archive"]);
    expect(validateContractAction(completed, "send_reminder")).toEqual({
      allowed: false,
      code: "SIGNFLOW_INVALID_REMINDER_STEP",
    });
  });

  test("archived contracts only allow unarchive", () => {
    const draft = buildContract();
    const archived = applyAndMerge(draft, "archive");

    expect(getAvailableContractActions(archived)).toEqual(["unarchive"]);
    expect(validateContractAction(archived, "confirm_sender")).toEqual({
      allowed: false,
      code: "CONTRACT_ARCHIVED_RESTORE_REQUIRED",
    });
    expect(validateContractAction(draft, "unarchive")).toEqual({
      allowed: false,
      code: "CONTRACT_NOT_ARCHIVED",
    });
  });
});

