import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockApplySubscriptionPaymentSuccess = jest.fn();
const mockBuildSubscriptionPaymentFields = jest.fn();
const mockGetPaymentRecordById = jest.fn();
const mockGetPaymentRecordForUserByReference = jest.fn();
const mockUpdatePaymentRecordFields = jest.fn();

jest.mock("@/lib/config/region", () => ({
  isChinaRegion: () => false,
}));

jest.mock("@/lib/payment/subscription-payment-sync", () => ({
  applySubscriptionPaymentSuccess: (...args: unknown[]) =>
    mockApplySubscriptionPaymentSuccess(...args),
  buildSubscriptionPaymentFields: (...args: unknown[]) =>
    mockBuildSubscriptionPaymentFields(...args),
  getPaymentRecordById: (...args: unknown[]) => mockGetPaymentRecordById(...args),
  getPaymentRecordForUserByReference: (...args: unknown[]) =>
    mockGetPaymentRecordForUserByReference(...args),
  updatePaymentRecordFields: (...args: unknown[]) => mockUpdatePaymentRecordFields(...args),
}));

jest.mock("@/lib/integrations/supabase-admin", () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: {
              id: "pay_new",
              user_id: "user_1",
              transaction_id: "txn_new",
              status: "pending",
              payment_method: "onetime",
              metadata: {},
            },
            error: null,
          }),
        })),
      })),
    })),
  },
}));

import { ensureOnetimeMembershipApplied } from "@/lib/payment/onetime-membership-sync";

describe("ensureOnetimeMembershipApplied", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});

    mockBuildSubscriptionPaymentFields.mockReturnValue({
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("reuses existing payment and delegates to unified subscription success", async () => {
    mockGetPaymentRecordForUserByReference.mockResolvedValue({
      id: "pay_1",
      user_id: "user_1",
      status: "pending",
      payment_method: "paypal",
      transaction_id: "txn_1",
      metadata: {},
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "pay_1",
      user_id: "user_1",
      status: "pending",
      payment_method: "paypal",
      transaction_id: "txn_1",
      metadata: { existing: true },
      billing_cycle: "monthly",
    });
    mockApplySubscriptionPaymentSuccess.mockResolvedValue({
      paymentId: "pay_1",
      subscriptionId: "sub_1",
      metadata: {
        planType: "pro",
        billingCycle: "monthly",
        days: 30,
        productType: "subscription",
        productName: "Pro Monthly Subscription",
      },
    });

    const result = await ensureOnetimeMembershipApplied({
      userId: "user_1",
      transactionId: "txn_1",
      days: 30,
      source: "test",
    });

    expect(result).toEqual({
      success: true,
      paymentId: "pay_1",
      subscriptionId: "sub_1",
    });
    expect(mockUpdatePaymentRecordFields).toHaveBeenCalledWith(
      "pay_1",
      expect.objectContaining({
        billing_cycle: "monthly",
        product_type: "subscription",
      }),
    );
    expect(mockApplySubscriptionPaymentSuccess).toHaveBeenCalledTimes(1);
  });

  test("returns failure when unified apply throws", async () => {
    mockGetPaymentRecordForUserByReference.mockResolvedValue({
      id: "pay_2",
      user_id: "user_2",
      status: "pending",
      payment_method: "stripe",
      transaction_id: "txn_2",
      metadata: {},
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "pay_2",
      user_id: "user_2",
      status: "pending",
      payment_method: "stripe",
      transaction_id: "txn_2",
      metadata: {},
    });
    mockApplySubscriptionPaymentSuccess.mockRejectedValue(
      new Error("sync failed"),
    );

    const result = await ensureOnetimeMembershipApplied({
      userId: "user_2",
      transactionId: "txn_2",
      days: 30,
      source: "test",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("UNIFIED_MEMBERSHIP_SYNC_FAILED");
  });
});
