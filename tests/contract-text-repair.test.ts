import { describe, expect, test } from "@jest/globals";

import {
  deepRepairPossibleMojibake,
  repairPossibleMojibake,
} from "@/lib/contracts/text-repair.server";

describe("contract text repair", () => {
  test("repairs common UTF-8/GBK mojibake fragments", () => {
    expect(repairPossibleMojibake("鍚堝悓")).toBe("合同");
    expect(repairPossibleMojibake("绛剧讲璇佹嵁")).toBe("签署证据");
    expect(repairPossibleMojibake("涓嬭浇澶辫触")).toBe("下载失败");
  });

  test("does not mutate normal Chinese content", () => {
    expect(repairPossibleMojibake("合同")).toBe("合同");
    expect(repairPossibleMojibake("签署流程已发起")).toBe("签署流程已发起");
  });

  test("deep repair fixes nested objects and arrays", () => {
    const input = {
      title: "鍚堝悓",
      metadata: {
        signFlow: {
          evidence: [{ label: "绛剧讲璇佹嵁", description: "涓嬭浇澶辫触" }],
        },
      },
    };

    const repaired = deepRepairPossibleMojibake(input);

    expect(repaired.title).toBe("合同");
    expect(repaired.metadata.signFlow.evidence[0].label).toBe("签署证据");
    expect(repaired.metadata.signFlow.evidence[0].description).toBe("下载失败");
  });
});

