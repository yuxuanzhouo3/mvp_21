import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const contractStore = new Map<string, any>();
let contractSeq = 1;

const mockRequireAuth: any = jest.fn();
const mockCreateAuthErrorResponse: any = jest.fn();
const mockGetPaymentRecordById: any = jest.fn();
const mockGetPaymentRecordForUserByReference: any = jest.fn();
const mockApplySubscriptionPaymentSuccess: any = jest.fn();
const mockPaymentRateLimit: any = jest.fn();
const mockStripeConfirmPayment: any = jest.fn();

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => false,
}));

jest.mock("@/lib/auth/auth-utils", () => ({
  extractTokenFromRequest: () => ({ token: "token_ok" }),
  verifyAuthToken: () =>
    Promise.resolve({
      success: true,
      userId: "user_mainline",
      user: {
        role: "user",
        subscription_plan: "pro",
        subscription_status: "active",
      },
    }),
}));

jest.mock("@/lib/account/server-profile", () => ({
  loadChinaAccountProfile: () => Promise.resolve(null),
  loadIntlAccountProfile: () =>
    Promise.resolve({
      id: "user_mainline",
      subscription_plan: "pro",
      subscription_status: "active",
    }),
}));

jest.mock("@/lib/data/admin-settings-store", () => ({
  loadAdminSettings: () => Promise.resolve({}),
}));

jest.mock("@/lib/membership/policy", () => ({
  buildMembershipEntitlements: () => ({
    membership: { plan: "pro" },
    features: { canUseAiChat: true, canGenerateContract: true },
    limits: { contractsPerMonth: null },
  }),
  getCurrentMonthWindow: () => ({
    startAt: "2026-04-01T00:00:00.000Z",
    endBefore: "2026-05-01T00:00:00.000Z",
  }),
}));

jest.mock("@/lib/auth/user-role", () => ({
  isAdminRole: () => false,
}));

jest.mock("@/lib/data/unified-models", () => ({
  normalizeContractStatus: (status: string | undefined) => status || "draft",
}));

jest.mock("@/lib/data/contracts-store", () => ({
  listContracts: async () => ({ contracts: Array.from(contractStore.values()), total: contractStore.size }),
  countContractsByUserInRange: async () => contractStore.size,
  createContractRecord: async (input: Record<string, unknown>) => {
    const id = `contract_${contractSeq++}`;
    const next = {
      id,
      userId: input.userId,
      title: input.title,
      type: input.type || "general",
      status: input.status || "draft",
      content: input.content || { title: input.title || "Untitled", body: "" },
      parties: input.parties || [],
      signatures: input.signatures || [],
      metadata: input.metadata || {},
      sourceType: input.sourceType || "text",
      sourceContent: input.sourceContent || "",
      analysisResult: input.analysisResult || null,
      region: input.region || "INTL",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    contractStore.set(id, next);
    return next;
  },
  getContractById: async (id: string) => contractStore.get(id) || null,
  updateContractRecord: async (id: string, updates: Record<string, unknown>) => {
    const current = contractStore.get(id);
    if (!current) {
      throw new Error("not found");
    }
    const next = {
      ...current,
      ...updates,
      metadata: updates.metadata || current.metadata,
      updatedAt: new Date().toISOString(),
    };
    contractStore.set(id, next);
    return next;
  },
  deleteContractRecord: async (id: string) => {
    contractStore.delete(id);
  },
}));

jest.mock("@/lib/contracts/format", () => ({
  normalizeContractContent: (content: any) => content,
  sanitizeDownloadFileName: (name: string) => name,
  buildContractHtml: (content: any) => `<h1>${content.title}</h1>`,
  buildContractDocumentHtml: (title: string, body: string) =>
    `<!doctype html><html><body><h1>${title}</h1>${body}</body></html>`,
}));

jest.mock("@/lib/contracts/pdf", () => ({
  buildContractPdfBuffer: async () => Buffer.from("%PDF-1.4"),
}));

jest.mock("@/lib/data/dashboard-documents-store", () => ({
  getPublicDashboardDocumentVerificationData: async (token: string, origin: string) => ({
    token,
    origin,
    status: "verified",
  }),
}));

jest.mock("@/lib/auth/auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  createAuthErrorResponse: (...args: unknown[]) => mockCreateAuthErrorResponse(...args),
}));

jest.mock("@/lib/payment/subscription-payment-sync", () => ({
  getPaymentRecordById: (...args: unknown[]) => mockGetPaymentRecordById(...args),
  getPaymentRecordForUserByReference: (...args: unknown[]) =>
    mockGetPaymentRecordForUserByReference(...args),
  applySubscriptionPaymentSuccess: (...args: unknown[]) =>
    mockApplySubscriptionPaymentSuccess(...args),
}));

jest.mock("@/lib/security/rate-limit", () => ({
  paymentRateLimit: (...args: unknown[]) => mockPaymentRateLimit(...args),
}));

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider",
  () => ({
    StripeProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockStripeConfirmPayment,
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/paypal-provider",
  () => ({
    PayPalProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: async () => ({ success: true, transactionId: "pp_txn", amount: 99, currency: "USD" }),
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider",
  () => ({
    AlipayProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: async () => ({ success: true, transactionId: "ali_txn", amount: 99, currency: "CNY" }),
      queryPayment: async () => ({ trade_status: "TRADE_SUCCESS" }),
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3",
  () => ({
    WechatProviderV3: jest.fn().mockImplementation(() => ({
      queryOrderByOutTradeNo: async () => ({
        tradeState: "SUCCESS",
        transactionId: "wx_txn",
        amount: 9900,
      }),
    })),
  }),
);

import { POST as createContractPost } from "@/app/api/contracts/route";
import { PUT as updateContractPut } from "@/app/api/contracts/[id]/route";
import { GET as exportContractGet } from "@/app/api/contracts/[id]/export/route";
import { POST as paymentConfirmPost } from "@/app/api/payment/confirm/route";
import { GET as publicVerifyGet } from "@/app/api/public/documents/[token]/verify/route";

describe("mainline simulated e2e regression", () => {
  beforeEach(() => {
    contractStore.clear();
    contractSeq = 1;
    jest.clearAllMocks();

    mockRequireAuth.mockResolvedValue({
      user: {
        id: "user_mainline",
      },
    });
    mockCreateAuthErrorResponse.mockReturnValue(
      new Response(JSON.stringify({ success: false }), { status: 401 }),
    );
    mockPaymentRateLimit.mockImplementation(
      (_request: unknown, _response: unknown, next: () => Promise<void> | void) => next(),
    );
    mockStripeConfirmPayment.mockResolvedValue({
      success: true,
      transactionId: "stripe_txn_1",
      amount: 99,
      currency: "USD",
    });
  });

  test("covers create -> sign -> export -> payment confirm -> public verify", async () => {
    const createResponse = await createContractPost(
      new NextRequest("http://localhost/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          title: "主链路测试合同",
          type: "service",
          content: {
            title: "主链路测试合同",
            body: "甲乙双方约定...",
          },
          parties: [
            { role: "partyA", name: "甲方" },
            { role: "partyB", name: "乙方" },
          ],
        }),
      }),
    );

    expect(createResponse.status).toBe(200);
    const createdPayload = await createResponse.json();
    const contractId = createdPayload.data.contract.id as string;
    expect(contractId).toBeTruthy();

    const startSigningResponse = await updateContractPut(
      new NextRequest(`http://localhost/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "start_signing",
        }),
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(startSigningResponse.status).toBe(200);

    const confirmResponse = await updateContractPut(
      new NextRequest(`http://localhost/api/contracts/${contractId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "confirm_counterparty",
          note: "e2e simulated confirm",
        }),
      }),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(confirmResponse.status).toBe(200);

    const exportResponse = await exportContractGet(
      new NextRequest(
        `http://localhost/api/contracts/${contractId}/export?format=html`,
        {
          method: "GET",
        },
      ),
      { params: Promise.resolve({ id: contractId }) },
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("Content-Type")).toContain("text/html");

    mockGetPaymentRecordById.mockResolvedValue({
      id: "pay_mainline_1",
      user_id: "user_mainline",
      status: "pending",
      payment_method: "stripe",
      transaction_id: "stripe_order_1",
      amount: 99,
      currency: "USD",
      metadata: {
        planType: "pro",
        billingCycle: "monthly",
        days: 30,
      },
    });
    mockApplySubscriptionPaymentSuccess.mockResolvedValue({
      paymentId: "pay_mainline_1",
      subscriptionId: "sub_mainline_1",
      metadata: {
        planType: "pro",
        billingCycle: "monthly",
      },
    });

    const paymentResponse = await paymentConfirmPost(
      new NextRequest("http://localhost/api/payment/confirm", {
        method: "POST",
        body: JSON.stringify({
          paymentId: "pay_mainline_1",
        }),
      }),
    );
    expect(paymentResponse.status).toBe(200);
    const paymentPayload = await paymentResponse.json();
    expect(paymentPayload.success).toBe(true);
    expect(paymentPayload.subscription.id).toBe("sub_mainline_1");

    const verifyResponse = await publicVerifyGet(
      new NextRequest("http://localhost/api/public/documents/token_1/verify"),
      { params: Promise.resolve({ token: "token_1" }) },
    );
    expect(verifyResponse.status).toBe(200);
    const verifyPayload = await verifyResponse.json();
    expect(verifyPayload.success).toBe(true);
    expect(verifyPayload.data.status).toBe("verified");
  });
});

