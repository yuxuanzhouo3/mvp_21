import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockAnalyzeConversation: any = jest.fn();
const mockGenerateContract: any = jest.fn();
const mockExtractTokenFromRequest: any = jest.fn();
const mockVerifyAuthToken: any = jest.fn();
const mockLoadChinaAccountProfile: any = jest.fn();
const mockLoadIntlAccountProfile: any = jest.fn();
const mockLoadAdminSettings: any = jest.fn();
const mockGetDashboardTemplateById: any = jest.fn();
const mockBuildMembershipEntitlements: any = jest.fn();
const mockIsChinaRegion: any = jest.fn();

class MockContractAIError extends Error {
  code: string;
  status: number;
  provider?: string;

  constructor(message: string, code: string, status = 500, provider?: string) {
    super(message);
    this.name = "ContractAIError";
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

jest.mock("@/lib/ai", () => ({
  ContractAIError: MockContractAIError,
  analyzeConversation: (...args: unknown[]) => mockAnalyzeConversation(...args),
  generateContract: (...args: unknown[]) => mockGenerateContract(...args),
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: (...args: unknown[]) =>
    mockExtractTokenFromRequest(...args),
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion(),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: (...args: unknown[]) =>
    mockLoadChinaAccountProfile(...args),
  loadIntlAccountProfile: (...args: unknown[]) =>
    mockLoadIntlAccountProfile(...args),
}));

jest.mock("@/lib/data/admin-settings-store", () => ({
  loadAdminSettings: (...args: unknown[]) => mockLoadAdminSettings(...args),
}));

jest.mock("@/lib/data/dashboard-store", () => ({
  getDashboardTemplateById: (...args: unknown[]) =>
    mockGetDashboardTemplateById(...args),
}));

jest.mock("@/lib/membership/policy", () => ({
  buildMembershipEntitlements: (...args: unknown[]) =>
    mockBuildMembershipEntitlements(...args),
}));

import { POST as analyzePost } from "@/app/api/contracts/analyze/route";
import { POST as generatePost } from "@/app/api/contracts/generate/route";

describe("contracts AI routes degraded mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_GENERATE_ROUTE_BUDGET_MS = "45000";
    process.env.AI_GENERATE_TOTAL_ROUTE_BUDGET_MS = "55000";
    process.env.AI_GENERATE_ROUTE_SAFETY_BUFFER_MS = "3000";
    mockIsChinaRegion.mockReturnValue(true);
    mockExtractTokenFromRequest.mockReturnValue({
      token: "token_ok",
      error: null,
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "user_1",
      user: { id: "user_1" },
    });
  });

  test("analyze route returns success degraded payload when AI times out", async () => {
    mockAnalyzeConversation.mockRejectedValue(
      new MockContractAIError("timeout", "AI_TIMEOUT", 504, "dashscope"),
    );

    const response = await analyzePost(
      new NextRequest("http://localhost/api/contracts/analyze", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content:
            "甲方: 晨佑科技\n乙方: 张三工作室\n合作内容: 小程序开发\n金额: 120000 元\n付款节点: 40%-40%-20%",
          sourceType: "text",
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta?.degraded).toBe(true);
    expect(Array.isArray(payload.data?.keyTerms)).toBe(true);
    expect(payload.data?.keyTerms?.length).toBeGreaterThan(0);
  });

  test("generate route returns success degraded draft when AI times out", async () => {
    mockLoadChinaAccountProfile.mockResolvedValue({
      subscription_plan: "pro",
      subscription_status: "active",
    });
    mockLoadIntlAccountProfile.mockResolvedValue(null);
    mockLoadAdminSettings.mockResolvedValue({});
    mockBuildMembershipEntitlements.mockReturnValue({
      features: { canGenerateContract: true },
    });
    mockGetDashboardTemplateById.mockResolvedValue(null);

    mockGenerateContract.mockRejectedValue(
      new MockContractAIError("timeout", "AI_TIMEOUT", 504, "dashscope"),
    );

    const response = await generatePost(
      new NextRequest("http://localhost/api/contracts/generate", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          analysisResult: {
            contractType: "service",
            confidence: 0.6,
            partyA: { name: "甲方公司" },
            partyB: { name: "乙方团队" },
            keyTerms: [
              {
                type: "payment",
                label: "付款方式",
                value: "分三期支付",
                source: "input",
                confidence: 0.7,
              },
            ],
            summary: "软件开发服务，分三期付款。",
          },
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta?.degraded).toBe(true);
    expect(payload.data?.sections?.length).toBeGreaterThan(0);
    expect(payload.data?.title).toBeTruthy();
  });

  test("generate route degrades quickly when model call stalls", async () => {
    process.env.AI_GENERATE_ROUTE_BUDGET_MS = "20";
    process.env.AI_GENERATE_TOTAL_ROUTE_BUDGET_MS = "80";
    process.env.AI_GENERATE_ROUTE_SAFETY_BUFFER_MS = "10";

    mockLoadChinaAccountProfile.mockResolvedValue({
      subscription_plan: "pro",
      subscription_status: "active",
    });
    mockLoadIntlAccountProfile.mockResolvedValue(null);
    mockLoadAdminSettings.mockResolvedValue({});
    mockBuildMembershipEntitlements.mockReturnValue({
      features: { canGenerateContract: true },
    });
    mockGetDashboardTemplateById.mockResolvedValue(null);
    mockGenerateContract.mockImplementation(() => new Promise<never>(() => {}));

    const response = await generatePost(
      new NextRequest("http://localhost/api/contracts/generate", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          analysisResult: {
            contractType: "service",
            confidence: 0.6,
            partyA: { name: "Party A" },
            partyB: { name: "Party B" },
            keyTerms: [
              {
                type: "payment",
                label: "payment",
                value: "3 milestones",
                source: "input",
                confidence: 0.7,
              },
            ],
            summary: "service agreement",
          },
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta?.degraded).toBe(true);
    expect(String(payload.meta?.reason || "")).toContain(
      "AI generation route timeout",
    );
  });
});
