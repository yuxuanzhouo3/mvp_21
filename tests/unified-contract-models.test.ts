import { describe, expect, test } from "@jest/globals";

import { normalizeContractRecord } from "@/lib/data/unified-models";

describe("normalizeContractRecord", () => {
  test("prefers envelope fields from content for legacy intl rows", () => {
    const record = normalizeContractRecord({
      id: "contract_1",
      user_id: "user_1",
      title: "Legacy contract",
      type: "stale-type",
      source_type: "stale-source",
      source_content: "stale content",
      ai_analysis: { summary: "legacy analysis" },
      parties: [{ name: "stale party" }],
      signatures: [{ id: "stale-signature" }],
      content: JSON.stringify({
        document: { body: "latest body" },
        type: "service",
        sourceType: "upload",
        sourceContent: "latest content",
        analysisResult: { summary: "latest analysis" },
        parties: [{ name: "latest party" }],
        signatures: [{ id: "latest-signature" }],
        metadata: { stage: "latest" },
        region: "INTL",
      }),
      status: "draft",
      created_at: "2026-04-18T00:00:00.000Z",
      updated_at: "2026-04-18T01:00:00.000Z",
    });

    expect(record.type).toBe("service");
    expect(record.sourceType).toBe("upload");
    expect(record.sourceContent).toBe("latest content");
    expect(record.analysisResult).toEqual({ summary: "latest analysis" });
    expect(record.parties).toEqual([{ name: "latest party" }]);
    expect(record.signatures).toEqual([{ id: "latest-signature" }]);
    expect(record.metadata).toEqual({ stage: "latest" });
    expect(record.region).toBe("INTL");
    expect(record.content).toEqual({ body: "latest body" });
  });

  test("keeps non-envelope rows compatible with cn style records", () => {
    const record = normalizeContractRecord({
      id: "contract_2",
      user_id: "user_2",
      title: "CN contract",
      type: "custom",
      source_type: "text",
      source_content: "plain text",
      analysis_result: { summary: "cn analysis" },
      parties: [{ name: "sender" }],
      signatures: [{ id: "sign_1" }],
      metadata: { stage: "draft" },
      content: JSON.stringify({ clauses: ["a", "b"] }),
      status: "pending",
    });

    expect(record.type).toBe("custom");
    expect(record.sourceType).toBe("text");
    expect(record.sourceContent).toBe("plain text");
    expect(record.analysisResult).toEqual({ summary: "cn analysis" });
    expect(record.parties).toEqual([{ name: "sender" }]);
    expect(record.signatures).toEqual([{ id: "sign_1" }]);
    expect(record.metadata).toEqual({ stage: "draft" });
    expect(record.content).toEqual({ clauses: ["a", "b"] });
  });
});
