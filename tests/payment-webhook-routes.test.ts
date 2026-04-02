import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockWebhookProcess = jest.fn();
const mockWebhookRateLimit = jest.fn();
const mockConstructEvent = jest.fn();
const mockLogBusinessEvent = jest.fn();
const mockLogError = jest.fn();
const mockLogSecurityEvent = jest.fn();

jest.mock("@/lib/payment/webhook-handler", () => ({
  WebhookHandler: {
    getInstance: () => ({
      processWebhook: mockWebhookProcess,
    }),
  },
}));

jest.mock("@/lib/security/rate-limit", () => ({
  webhookRateLimit: (...args: unknown[]) => mockWebhookRateLimit(...args),
}));

jest.mock("@/lib/utils/logger", () => ({
  logBusinessEvent: (...args: unknown[]) => mockLogBusinessEvent(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
  logSecurityEvent: (...args: unknown[]) => mockLogSecurityEvent(...args),
}));

jest.mock("stripe", () => ({
  webhooks: {
    constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
  },
}));

import { POST as stripeWebhookPost } from "@/app/api/payment/webhook/stripe/route";
import { POST as paypalWebhookPost } from "@/app/api/payment/webhook/paypal/route";

describe("payment webhook route coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.PAYPAL_SKIP_SIGNATURE_VERIFICATION = "true";
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    mockWebhookRateLimit.mockImplementation(
      (_request: unknown, _response: unknown, next: () => Promise<void> | void) => next(),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("stripe webhook rejects invalid signatures before processing", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const body = JSON.stringify({
      id: "evt_invalid",
      type: "checkout.session.completed",
      livemode: false,
    });

    const response = await stripeWebhookPost(
      new NextRequest("http://localhost/api/payment/webhook/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "invalid",
        },
        body,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Invalid signature" });
    expect(mockWebhookProcess).not.toHaveBeenCalled();
  });

  test("stripe webhook forwards verified events into the unified handler", async () => {
    mockConstructEvent.mockReturnValue({});
    mockWebhookProcess.mockResolvedValue(true);

    const eventPayload = {
      id: "evt_success",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          id: "cs_test_123",
        },
      },
    };

    const response = await stripeWebhookPost(
      new NextRequest("http://localhost/api/payment/webhook/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "valid-signature",
          "user-agent": "jest",
        },
        body: JSON.stringify(eventPayload),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "success" });
    expect(mockWebhookProcess).toHaveBeenCalledWith(
      "stripe",
      "checkout.session.completed",
      eventPayload,
    );
  });

  test("paypal webhook injects the transmission id for deduplication before processing", async () => {
    mockWebhookProcess.mockResolvedValue(true);

    const eventPayload = {
      id: "WH-123",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "capture-1",
      },
    };

    const response = await paypalWebhookPost(
      new NextRequest("http://localhost/api/payment/webhook/paypal", {
        method: "POST",
        headers: {
          "paypal-transmission-id": "transmission-1",
          "paypal-transmission-sig": "sig-1",
          "paypal-cert-url": "https://api-m.paypal.com/certs/test",
          "paypal-transmission-time": "2026-04-02T10:00:00Z",
          "paypal-auth-algo": "SHA256withRSA",
        },
        body: JSON.stringify(eventPayload),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: "success" });
    expect(mockWebhookProcess).toHaveBeenCalledWith(
      "paypal",
      "PAYMENT.CAPTURE.COMPLETED",
      expect.objectContaining({
        id: "WH-123",
        _paypal_transmission_id: "transmission-1",
      }),
    );
  });
});
