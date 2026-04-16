import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockRunContractIntakeChat: any = jest.fn();
const mockAnalyzeContractChatScreenshot: any = jest.fn();
const mockExtractTokenFromRequest: any = jest.fn();
const mockVerifyAuthToken: any = jest.fn();
const mockLoadChinaAccountProfile: any = jest.fn();
const mockLoadIntlAccountProfile: any = jest.fn();
const mockLoadAdminSettings: any = jest.fn();
const mockBuildMembershipEntitlements: any = jest.fn();
const mockIsChinaRegion: any = jest.fn();

class MockContractChatOcrError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = "ContractChatOcrError";
    this.code = code;
    this.status = status;
  }
}

jest.mock("@/lib/ai/contract-intake-chat", () => ({
  runContractIntakeChat: (...args: unknown[]) => mockRunContractIntakeChat(...args),
}));

jest.mock("@/lib/ocr/contract-chat", () => ({
  analyzeContractChatScreenshot: (...args: unknown[]) =>
    mockAnalyzeContractChatScreenshot(...args),
  ContractChatOcrError: MockContractChatOcrError,
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

jest.mock("@/lib/membership/policy", () => ({
  buildMembershipEntitlements: (...args: unknown[]) =>
    mockBuildMembershipEntitlements(...args),
}));

import { POST as aiChatPost } from "@/app/api/contracts/ai-chat/route";
import { POST as importScreenshotPost } from "@/app/api/contracts/import-screenshot/route";

describe("contract creation entry routes degraded mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    mockLoadChinaAccountProfile.mockResolvedValue({
      subscription_plan: "pro",
      subscription_status: "active",
    });
    mockLoadIntlAccountProfile.mockResolvedValue(null);
    mockLoadAdminSettings.mockResolvedValue({});
    mockBuildMembershipEntitlements.mockReturnValue({
      features: { canUseAiChat: true },
    });
  });

  test("ai-chat returns success degraded payload when AI chat times out", async () => {
    mockRunContractIntakeChat.mockRejectedValue(new Error("AI_CHAT_TIMEOUT"));

    const response = await aiChatPost(
      new NextRequest("http://localhost/api/contracts/ai-chat", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "帮我做一份软件开发合同" }],
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta?.degraded).toBe(true);
    expect(payload.data?.reply).toBeTruthy();
    expect(payload.data?.ready).toBe(false);
  });

  test("import-screenshot returns success degraded payload when OCR times out", async () => {
    mockAnalyzeContractChatScreenshot.mockRejectedValue(
      new MockContractChatOcrError("timeout", "OCR_TIMEOUT", 504),
    );

    const response = await importScreenshotPost(
      new NextRequest("http://localhost/api/contracts/import-screenshot", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          imageBase64: "data:image/png;base64,abc123",
          sourceHint: "wechat",
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.meta?.degraded).toBe(true);
    expect(payload.data?.sourceType).toBe("wechat");
    expect(typeof payload.data?.conversationText).toBe("string");
    expect(payload.data?.conversationText?.length).toBeGreaterThan(0);
  });
});
