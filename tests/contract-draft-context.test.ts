import { describe, expect, test } from "@jest/globals";

import {
  applyActiveCompanyProfileToAnalysis,
  buildCompanyProfileContactSummary,
  createActiveCompanyProfileSnapshot,
} from "@/lib/contracts/draft-context";

describe("contract draft context", () => {
  test("active company profile is injected into party A during draft preparation", () => {
    const snapshot = createActiveCompanyProfileSnapshot({
      id: "company-1",
      userId: "user-1",
      companyName: "晨光科技有限公司",
      creditCode: "91310000TEST123",
      legalPerson: "张三",
      address: "上海市浦东新区张江路 88 号",
      contactPerson: "李四",
      contactPhone: "13800000000",
      contactEmail: "ops@morn.test",
      updatedAt: "2026-04-02T10:00:00.000Z",
    });

    const result = applyActiveCompanyProfileToAnalysis(
      {
        contractType: "service",
        confidence: 0.92,
        summary: "服务合作沟通摘要",
        partyA: {
          name: "临时甲方",
          role: "",
          company: "",
        },
        partyB: {
          name: "乙方小王",
          role: "乙方",
          company: "自由职业者",
        },
        keyTerms: [],
      },
      snapshot,
    );

    expect(result.partyA.name).toBe("晨光科技有限公司");
    expect(result.partyA.company).toBe("晨光科技有限公司");
    expect(result.partyA.role).toBe("甲方");
    expect(result.partyA.identified).toBe(true);
    expect(result.partyA.contact).toContain("联系人: 李四");
    expect(result.partyA.contact).toContain("统一社会信用代码: 91310000TEST123");
  });

  test("contact summary keeps the useful company identity fields together", () => {
    const summary = buildCompanyProfileContactSummary({
      id: "company-2",
      companyName: "Morn Contract",
      creditCode: "91310000CN",
      legalPerson: "Alice",
      address: "Shanghai",
      contactPerson: "Bob",
      contactPhone: "13812345678",
      contactEmail: "ops@example.com",
    });

    expect(summary).toContain("联系人: Bob");
    expect(summary).toContain("电话: 13812345678");
    expect(summary).toContain("邮箱: ops@example.com");
    expect(summary).toContain("地址: Shanghai");
    expect(summary).toContain("法定代表人: Alice");
  });
});
