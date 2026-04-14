import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockExtractTokenFromRequest: any = jest.fn();
const mockVerifyAuthToken: any = jest.fn();
const mockLoadChinaAccountProfile: any = jest.fn();
const mockLoadIntlAccountProfile: any = jest.fn();
const mockLoadAdminSettings: any = jest.fn();
const mockBuildMembershipEntitlements: any = jest.fn();
const mockGetContractById: any = jest.fn();
const mockEnqueueContractGenerationJob: any = jest.fn();
const mockToGenerationJobPublic: any = jest.fn();
const mockFailStaleGenerationJobIfNeeded: any = jest.fn();
const mockParseContractIdFromGenerationJobId: any = jest.fn();
const mockReadGenerationJobFromMetadata: any = jest.fn();
const mockScheduleContractGenerationJob: any = jest.fn();
const mockIsChinaRegion: any = jest.fn();

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: (...args: unknown[]) =>
    mockExtractTokenFromRequest(...args),
  verifyAuthToken: (...args: unknown[]) => mockVerifyAuthToken(...args),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: (...args: unknown[]) =>
    mockLoadChinaAccountProfile(...args),
  loadIntlAccountProfile: (...args: unknown[]) =>
    mockLoadIntlAccountProfile(...args),
}));

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => mockIsChinaRegion(),
}));

jest.mock("@/lib/data/admin-settings-store", () => ({
  loadAdminSettings: (...args: unknown[]) => mockLoadAdminSettings(...args),
}));

jest.mock("@/lib/data/contracts-store", () => ({
  getContractById: (...args: unknown[]) => mockGetContractById(...args),
}));

jest.mock("@/lib/membership/policy", () => ({
  buildMembershipEntitlements: (...args: unknown[]) =>
    mockBuildMembershipEntitlements(...args),
}));

jest.mock("@/lib/contracts/generation-jobs", () => ({
  enqueueContractGenerationJob: (...args: unknown[]) =>
    mockEnqueueContractGenerationJob(...args),
  toGenerationJobPublic: (...args: unknown[]) => mockToGenerationJobPublic(...args),
  failStaleGenerationJobIfNeeded: (...args: unknown[]) =>
    mockFailStaleGenerationJobIfNeeded(...args),
  parseContractIdFromGenerationJobId: (...args: unknown[]) =>
    mockParseContractIdFromGenerationJobId(...args),
  readGenerationJobFromMetadata: (...args: unknown[]) =>
    mockReadGenerationJobFromMetadata(...args),
  scheduleContractGenerationJob: (...args: unknown[]) =>
    mockScheduleContractGenerationJob(...args),
}));

import { POST as enqueueJobPost } from "@/app/api/contracts/generate/jobs/route";
import { GET as queryJobGet } from "@/app/api/contracts/generate/jobs/[jobId]/route";

describe("contract generation jobs route timeout guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONTRACTS_ENQUEUE_TIMEOUT_MS = "20";
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
      features: { canGenerateContract: true },
    });
    mockParseContractIdFromGenerationJobId.mockReturnValue("contract_1");
    mockReadGenerationJobFromMetadata.mockReturnValue({
      id: "contract_1~job",
      status: "running",
      queuedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      attemptCount: 1,
      contractId: "contract_1",
      userId: "user_1",
      request: {},
    });
    mockFailStaleGenerationJobIfNeeded.mockImplementation(async (_contract: unknown, _jobId: string) => ({
      id: "contract_1~job",
      status: "running",
      queuedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
      attemptCount: 1,
      contractId: "contract_1",
      userId: "user_1",
      request: {},
    }));
    mockToGenerationJobPublic.mockImplementation((job: any) => job);
    mockGetContractById.mockResolvedValue({
      id: "contract_1",
      userId: "user_1",
      metadata: {},
    });
  });

  test("returns 503 instead of hanging when enqueue operation stalls", async () => {
    mockEnqueueContractGenerationJob.mockImplementation(
      () => new Promise<never>(() => {}),
    );

    const response = await enqueueJobPost(
      new NextRequest("http://localhost/api/contracts/generate/jobs", {
        method: "POST",
        headers: {
          authorization: "Bearer token_ok",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          contractId: "contract_1",
          analysisResult: {
            contractType: "service",
            keyTerms: [{ type: "payment", label: "付款", value: "分期付款", source: "input", confidence: 0.7 }],
          },
        }),
      }),
    );

    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe("ENQUEUE_TIMEOUT");
  });

  test("job status query returns 404 instead of hanging when contract query stalls", async () => {
    process.env.CONTRACTS_QUERY_TIMEOUT_MS = "20";
    mockGetContractById.mockImplementation(() => new Promise<never>(() => {}));

    const response = await queryJobGet(
      new NextRequest("http://localhost/api/contracts/generate/jobs/contract_1~job", {
        method: "GET",
        headers: {
          authorization: "Bearer token_ok",
        },
      }),
      {
        params: Promise.resolve({ jobId: "contract_1~job" }),
      },
    );

    const payload = await response.json();
    expect(response.status).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error?.code).toBe("JOB_NOT_FOUND");
  });
});
