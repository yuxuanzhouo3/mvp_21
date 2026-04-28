import { describe, expect, test } from "@jest/globals";

import type { ContractContent } from "@/lib/ai/types";
import { buildContractDocumentHtml, buildContractHtml } from "@/lib/contracts/format";
import {
  filterContractExportSignaturesByStage,
  resolveContractWorkflowStageFromStatuses,
} from "@/lib/contracts/workflow-stage";

const pngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pbdmLQAAAAASUVORK5CYII=";

const content: ContractContent = {
  title: "阶段导出测试合同",
  sections: [
    {
      id: "1",
      title: "第一条",
      content: "测试正文内容",
      order: 1,
      editable: true,
    },
  ],
  disclaimer: "",
  signature: {
    partyA: { name: "甲方" },
    partyB: { name: "乙方" },
  },
};

describe("contract export stage consistency", () => {
  test("resolveContractWorkflowStageFromStatuses maps statuses correctly", () => {
    expect(resolveContractWorkflowStageFromStatuses("draft", "not_started")).toBe("draft");
    expect(resolveContractWorkflowStageFromStatuses("awaiting_sender", "not_started")).toBe(
      "signing_started",
    );
    expect(
      resolveContractWorkflowStageFromStatuses("awaiting_counterparty", "not_started"),
    ).toBe("sender_signed");
    expect(resolveContractWorkflowStageFromStatuses("completed", "not_started")).toBe(
      "completed",
    );
    expect(resolveContractWorkflowStageFromStatuses("completed", "sealed")).toBe(
      "completed_sealed",
    );
  });

  test("buildContractHtml only includes signatures relevant to current stage", () => {
    const signatures = {
      sender: {
        role: "sender" as const,
        signerName: "Alice Sender",
        createdAt: "SENDER_TIME",
        method: "draw",
        source: "web",
        imageDataUrl: pngDataUrl,
      },
      counterparty: {
        role: "counterparty" as const,
        signerName: "Bob Counterparty",
        createdAt: "COUNTERPARTY_TIME",
        method: "type",
        source: "web",
        typedName: "Bob Signature",
      },
    };

    const draftHtml = buildContractHtml(content, {
      language: "en",
      signatures: filterContractExportSignaturesByStage(signatures, "draft"),
    });
    expect(draftHtml).not.toContain("Signature Records");
    expect(draftHtml).not.toContain("Alice Sender");
    expect(draftHtml).not.toContain("Bob Counterparty");

    const senderSignedHtml = buildContractHtml(content, {
      language: "en",
      signatures: filterContractExportSignaturesByStage(signatures, "sender_signed"),
    });
    expect(senderSignedHtml).toContain("Signature Records");
    expect(senderSignedHtml).toContain("Alice Sender");
    expect(senderSignedHtml).not.toContain("Bob Counterparty");

    const completedHtml = buildContractHtml(content, {
      language: "en",
      signatures: filterContractExportSignaturesByStage(signatures, "completed"),
    });
    expect(completedHtml).toContain("Alice Sender");
    expect(completedHtml).toContain("Bob Counterparty");
  });

  test("sealed html uses constrained image size and document html includes simhei font face", () => {
    const sealedHtml = buildContractHtml(content, {
      language: "zh",
      signatures: {
        sender: {
          role: "sender",
          signerName: "张三",
          createdAt: "2026-04-01T10:00:00.000Z",
          method: "draw",
          source: "mobile",
          imageDataUrl: pngDataUrl,
        },
      },
      seal: {
        stampedAt: "2026-04-01T11:00:00.000Z",
        stampedBy: "法务",
        stamp: {
          imageDataUrl: pngDataUrl,
          imageMimeType: "image/png",
          fileName: "seal.png",
          source: "unit-test",
        },
      },
    });

    expect(sealedHtml).toContain('width="160"');
    expect(sealedHtml).toContain('height="160"');
    expect(sealedHtml).toContain("盖章记录");

    const documentHtml = buildContractDocumentHtml(content.title, sealedHtml, {
      language: "zh",
    });
    expect(documentHtml).toContain("url(\"/fonts/simhei.ttf\")");
    expect(documentHtml).toContain("MornContractSimHei");
  });
});
