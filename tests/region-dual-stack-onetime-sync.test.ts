import { afterEach, describe, expect, jest, test } from "@jest/globals";

type Region = "CN" | "INTL";

async function loadOnetimeSyncHarness(region: Region) {
  jest.resetModules();

  const mockApplySubscriptionPaymentSuccess = jest.fn().mockResolvedValue({
    paymentId: region === "CN" ? "pay_cn_new" : "pay_intl_new",
    subscriptionId: region === "CN" ? "sub_cn_1" : "sub_intl_1",
    metadata: {
      planType: "pro",
      billingCycle: "monthly",
      days: 30,
      productType: "subscription",
      productName: "Pro Monthly Subscription",
    },
  });
  const mockBuildSubscriptionPaymentFields = jest.fn().mockReturnValue({
    billing_cycle: "monthly",
    product_type: "subscription",
    product_name: "Pro Monthly Subscription",
    metadata: {
      planType: "pro",
      billingCycle: "monthly",
      days: 30,
      productType: "subscription",
      productName: "Pro Monthly Subscription",
    },
  });
  const mockGetPaymentRecordById = jest.fn().mockResolvedValue(null);
  const mockGetPaymentRecordForUserByReference = jest
    .fn()
    .mockResolvedValue(null);
  const mockUpdatePaymentRecordFields = jest.fn().mockResolvedValue(undefined);

  const mockSupabaseInsertSingle = jest.fn().mockResolvedValue({
    data: {
      id: "pay_intl_new",
      user_id: "user_intl",
      status: "pending",
      payment_method: "onetime",
      transaction_id: "txn_intl",
      metadata: {},
    },
    error: null,
  });
  const mockSupabaseFrom = jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: mockSupabaseInsertSingle,
      })),
    })),
  }));

  const mockCloudPaymentsAdd = jest.fn().mockResolvedValue({ id: "pay_cn_new" });
  const mockCloudPaymentsDocGet = jest.fn().mockResolvedValue({
    data: [
      {
        _id: "pay_cn_new",
        user_id: "user_cn",
        status: "pending",
        payment_method: "onetime",
        transaction_id: "txn_cn",
        metadata: {},
      },
    ],
  });
  const mockCloudCollection = jest.fn((name: string) => {
    if (name === "payments") {
      return {
        add: mockCloudPaymentsAdd,
        doc: jest.fn(() => ({
          get: mockCloudPaymentsDocGet,
        })),
      };
    }

    return {
      add: jest.fn(),
      doc: jest.fn(() => ({ get: jest.fn() })),
    };
  });

  jest.doMock("@/lib/config/region", () => ({
    isChinaRegion: () => region === "CN",
  }));

  jest.doMock("@/lib/payment/subscription-payment-sync", () => ({
    applySubscriptionPaymentSuccess: (...args: unknown[]) =>
      mockApplySubscriptionPaymentSuccess(...args),
    buildSubscriptionPaymentFields: (...args: unknown[]) =>
      mockBuildSubscriptionPaymentFields(...args),
    getPaymentRecordById: (...args: unknown[]) =>
      mockGetPaymentRecordById(...args),
    getPaymentRecordForUserByReference: (...args: unknown[]) =>
      mockGetPaymentRecordForUserByReference(...args),
    updatePaymentRecordFields: (...args: unknown[]) =>
      mockUpdatePaymentRecordFields(...args),
  }));

  jest.doMock("@/lib/integrations/supabase-admin", () => ({
    supabaseAdmin: {
      from: mockSupabaseFrom,
    },
  }));

  jest.doMock("@/lib/cloudbase/cloudbase-service", () => ({
    getDatabase: () => ({
      collection: mockCloudCollection,
    }),
  }));

  const mod = await import("@/lib/payment/onetime-membership-sync");

  return {
    ensureOnetimeMembershipApplied: mod.ensureOnetimeMembershipApplied,
    mockApplySubscriptionPaymentSuccess,
    mockSupabaseFrom,
    mockCloudPaymentsAdd,
  };
}

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe("region dual-stack onetime membership sync", () => {
  test("INTL fallback keeps USD as default currency", async () => {
    const harness = await loadOnetimeSyncHarness("INTL");

    const result = await harness.ensureOnetimeMembershipApplied({
      userId: "user_intl",
      transactionId: "txn_intl",
      days: 30,
      source: "region-test-intl",
    });

    expect(result.success).toBe(true);
    expect(harness.mockSupabaseFrom).toHaveBeenCalledWith("payments");

    const applyArg = harness.mockApplySubscriptionPaymentSuccess.mock.calls[0][0];
    expect(applyArg.currency).toBe("USD");
  });

  test("CN fallback keeps CNY as default currency", async () => {
    const harness = await loadOnetimeSyncHarness("CN");

    const result = await harness.ensureOnetimeMembershipApplied({
      userId: "user_cn",
      transactionId: "txn_cn",
      days: 30,
      source: "region-test-cn",
    });

    expect(result.success).toBe(true);
    expect(harness.mockCloudPaymentsAdd).toHaveBeenCalledTimes(1);

    const applyArg = harness.mockApplySubscriptionPaymentSuccess.mock.calls[0][0];
    expect(applyArg.currency).toBe("CNY");
  });
});

