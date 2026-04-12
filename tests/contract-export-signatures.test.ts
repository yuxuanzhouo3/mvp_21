import { describe, expect, test } from "@jest/globals";

import type { ContractContent } from "@/lib/ai/types";
import { buildContractHtml } from "@/lib/contracts/format";
import { buildContractExportSignatures } from "@/lib/contracts/export-signatures";

describe("contract export signatures", () => {
  test("buildContractExportSignatures picks latest signature and falls back to confirmed participants", () => {
    const contract = {
      signatures: [
        {
          role: "sender",
          signerName: "Sender Old",
          createdAt: "2026-04-10T10:00:00.000Z",
          method: "type",
        },
        {
          role: "sender",
          signerName: "Sender New",
          createdAt: "2026-04-11T10:00:00.000Z",
          method: "draw",
        },
      ],
      metadata: {
        signFlow: {
          participants: [
            {
              role: "sender",
              name: "Sender Participant",
              status: "confirmed",
              confirmedAt: "2026-04-09T10:00:00.000Z",
            },
            {
              role: "counterparty",
              name: "Counterparty Participant",
              status: "confirmed",
              confirmedAt: "2026-04-12T10:00:00.000Z",
            },
          ],
        },
      },
    } as any;

    const signatures = buildContractExportSignatures(contract);

    expect(signatures.sender?.signerName).toBe("Sender New");
    expect(signatures.sender?.method).toBe("draw");
    expect(signatures.counterparty?.signerName).toBe("Counterparty Participant");
    expect(signatures.counterparty?.method).toBe("confirmation");
    expect(signatures.counterparty?.createdAt).toBe("2026-04-12T10:00:00.000Z");
  });

  test("buildContractHtml appends signature block with names, images and time", () => {
    const content: ContractContent = {
      title: "测试合同",
      sections: [
        {
          id: "1",
          title: "第一条",
          content: "合同内容",
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
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pbdmLQAAAAASUVORK5CYII=";

    const html = buildContractHtml(content, {
      language: "zh",
      signatures: {
        sender: {
          role: "sender",
          signerName: "张三",
          createdAt: "2026-04-12T08:30:00.000Z",
          method: "draw",
          source: "mobile",
          imageDataUrl: pngDataUrl,
        },
        counterparty: {
          role: "counterparty",
          signerName: "李四",
          createdAt: "2026-04-12T09:30:00.000Z",
          method: "type",
          source: "web",
          typedName: "Li Si",
        },
      },
    });

    expect(html).toContain("电子签署记录");
    expect(html).toContain("甲方（发起方）");
    expect(html).toContain("乙方（对方）");
    expect(html).toContain("张三");
    expect(html).toContain("李四");
    expect(html).toContain("签署时间");
    expect(html).toContain(pngDataUrl);
    expect(html).toContain("Li Si");
  });
});
