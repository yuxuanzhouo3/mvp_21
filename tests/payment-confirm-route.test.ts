import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest, NextResponse } from "next/server";

const mockRequireAuth = jest.fn();
const mockCreateAuthErrorResponse = jest.fn();
const mockGetPaymentRecordById = jest.fn();
const mockGetPaymentRecordForUserByReference = jest.fn();
const mockApplySubscriptionPaymentSuccess = jest.fn();
const mockPaymentRateLimit = jest.fn();
const mockLogBusinessEvent = jest.fn();
const mockLogError = jest.fn();
const mockLogSecurityEvent = jest.fn();

const mockPayPalConfirmPayment = jest.fn();
const mockStripeConfirmPayment = jest.fn();
const mockAlipayConfirmPayment = jest.fn();
const mockAlipayQueryPayment = jest.fn();
const mockWechatQueryOrderByOutTradeNo = jest.fn();

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

jest.mock("@/lib/utils/logger", () => ({
  logBusinessEvent: (...args: unknown[]) => mockLogBusinessEvent(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/paypal-provider",
  () => ({
    PayPalProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockPayPalConfirmPayment,
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/stripe-provider",
  () => ({
    StripeProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockStripeConfirmPayment,
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/alipay-provider",
  () => ({
    AlipayProvider: jest.fn().mockImplementation(() => ({
      confirmPayment: mockAlipayConfirmPayment,
      queryPayment: mockAlipayQueryPayment,
    })),
  }),
);

jest.mock(
  "@/lib/architecture-modules/layers/third-party/payment/providers/wechat-provider-v3",
  () => ({
    WechatProviderV3: jest.fn().mockImplementation(() => ({
      queryOrderByOutTradeNo: mockWechatQueryOrderByOutTradeNo,
    })),
  }),
);

import { POST } from "@/app/api/payment/confirm/route";

function createJsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/payment/confirm", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("payment confirm route coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateAuthErrorResponse.mockReturnValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    );

    mockPaymentRateLimit.mockImplementation(
      (_request: unknown, _response: unknown, next: () => Promise<void> | void) => next(),
    );
  });

  test("returns auth error when the user is not signed in", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ success: false, error: "Unauthorized" });
    expect(mockCreateAuthErrorResponse).toHaveBeenCalled();
  });

  test("blocks confirmation when the payment belongs to another user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-2",
      payment_method: "paypal",
      status: "pending",
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ success: false, error: "Forbidden" });
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
  });

  test("returns a provider rejection when confirmation fails upstream", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      payment_method: "paypal",
      transaction_id: "paypal-order-1",
      amount: 199,
      currency: "USD",
      status: "pending",
    });
    mockPayPalConfirmPayment.mockResolvedValue({
      success: false,
      transactionId: "paypal-order-1",
      amount: 199,
      currency: "USD",
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ success: false, error: "Payment confirmation failed" });
    expect(mockApplySubscriptionPaymentSuccess).not.toHaveBeenCalled();
  });

  test("syncs the subscription after a successful provider confirmation", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1" },
    });
    mockGetPaymentRecordById.mockResolvedValue({
      id: "payment-1",
      user_id: "user-1",
      payment_method: "paypal",
      transaction_id: "paypal-order-1",
      amount: 299,
      currency: "USD",
      status: "pending",
    });
    mockPayPalConfirmPayment.mockResolvedValue({
      success: true,
      transactionId: "paypal-capture-1",
      amount: 299,
      currency: "USD",
    });
    mockApplySubscriptionPaymentSuccess.mockResolvedValue({
      paymentId: "payment-1",
      subscriptionId: "subscription-1",
      metadata: {
        planType: "pro",
        billingCycle: "monthly",
        days: 30,
        productType: "subscription",
        productName: "Pro Monthly Subscription",
      },
    });

    const response = await POST(createJsonRequest({ paymentId: "payment-1" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockApplySubscriptionPaymentSuccess).toHaveBeenCalledWith({
      payment: expect.objectContaining({
        id: "payment-1",
        user_id: "user-1",
        payment_method: "paypal",
      }),
      finalTransactionId: "paypal-capture-1",
      providerReference: "paypal-order-1",
      amount: 299,
      currency: "USD",
      paymentMethod: "paypal",
    });
    expect(payload).toEqual({
      success: true,
      transactionId: "paypal-capture-1",
      amount: 299,
      currency: "USD",
      subscription: {
        id: "subscription-1",
        planId: "pro",
        status: "active",
        billingCycle: "monthly",
      },
    });
  });
});
