import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockCountContractsByUserInRange: any = jest.fn();
const mockCreateContractRecord: any = jest.fn();
const mockListContracts: any = jest.fn();
const mockLoadChinaAccountProfile: any = jest.fn();
const mockLoadIntlAccountProfile: any = jest.fn();
const mockExtractTokenFromRequest: any = jest.fn();
const mockVerifyAuthToken: any = jest.fn();
const mockIsChinaRegion: any = jest.fn();
const mockLoadAdminSettings: any = jest.fn();
const mockNormalizeContractStatus: any = jest.fn();
const mockBuildMembershipEntitlements: any = jest.fn();
const mockGetCurrentMonthWindow: any = jest.fn();
const mockIsAdminRole: any = jest.fn();

jest.mock("@/lib/data/contracts-store", () => ({
  countContractsByUserInRange: (...args: unknown[]) =>
    mockCountContractsByUserInRange(...args),
  createContractRecord: (...args: unknown[]) => mockCreateContractRecord(...args),
  listContracts: (...args: unknown[]) => mockListContracts(...args),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: (...args: unknown[]) =>
    mockLoadChinaAccountProfile(...args),
  loadIntlAccountProfile: (...args: unknown[]) =>
    mockLoadIntlAccountProfile(...args),
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: (...args: unknown[]) =>
    mockExtractTokenFromRequest(...args),
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion(),
}));

jest.mock("@/lib/data/admin-settings-store", () => ({
  loadAdminSettings: (...args: unknown[]) => mockLoadAdminSettings(...args),
}));

jest.mock("@/lib/data/unified-models", () => ({
  normalizeContractStatus: (...args: unknown[]) => mockNormalizeContractStatus(...args),
}));

jest.mock("@/lib/membership/policy", () => ({
  buildMembershipEntitlements: (...args: unknown[]) =>
    mockBuildMembershipEntitlements(...args),
  getCurrentMonthWindow: (...args: unknown[]) => mockGetCurrentMonthWindow(...args),
}));

jest.mock("@/lib/auth/user-role", () => ({
  isAdminRole: (...args: unknown[]) => mockIsAdminRole(...args),
}));

import { POST as contractsPost } from "@/app/api/contracts/route";

describe("/api/contracts POST timeout guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACTS_CREATE_TIMEOUT_MS = "20";
    mockIsChinaRegion.mockReturnValue(true);
    mockExtractTokenFromRequest.mockReturnValue({
      token: "token_ok",
      error: null,
    });
    mockVerifyAuthToken.mockResolvedValue({
      success: true,
      userId: "user_1",
      user: { id: "user_1", role: "admin" },
    });
    mockLoadChinaAccountProfile.mockResolvedValue(null);
    mockLoadIntlAccountProfile.mockResolvedValue(null);
    mockLoadAdminSettings.mockResolvedValue({});
    mockNormalizeContractStatus.mockReturnValue("draft");
    mockBuildMembershipEntitlements.mockReturnValue({
      limits: { contractsPerMonth: null },
      membership: { plan: "pro" },
    });
    mockGetCurrentMonthWindow.mockReturnValue({
      startAt: "2026-04-01T00:00:00.000Z",
      endBefore: "2026-05-01T00:00:00.000Z",
    });
    mockIsAdminRole.mockReturnValue(true);
    mockCountContractsByUserInRange.mockResolvedValue(0);
  });

  test("returns 503 when createContractRecord stalls", async () => {
    mockCreateContractRecord.mockImplementation(
      () => new Promise<never>(() => {}),
    );

    const response = await contractsPost(
      new NextRequest("http://localhost/api/contracts", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "测试合同",
          type: "service",
          status: "draft",
          content: {},
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe("CONTRACT_CREATE_TIMEOUT");
  });
});

