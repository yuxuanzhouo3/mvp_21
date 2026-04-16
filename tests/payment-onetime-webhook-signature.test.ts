import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const mockWebhookRateLimit: any = jest.fn();
const mockConstructEvent: any = jest.fn();

jest.mock("@/lib/security/rate-limit", () => ({
  webhookRateLimit: (...args: unknown[]) => mockWebhookRateLimit(...args),
}));

jest.mock("stripe", () => ({
  webhooks: {
    constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
  },
}));

jest.mock("@/lib/integrations/supabase-admin", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock("@/lib/payment/onetime-membership-sync", () => ({
  ensureOnetimeMembershipApplied: jest.fn(),
}));

jest.mock("@/lib/utils/logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn(),
  logBusinessEvent: jest.fn(),
}));

import { POST } from "@/app/api/payment/onetime/webhook/route";

describe("payment onetime webhook signature guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    mockWebhookRateLimit.mockImplementation(
      (_request: unknown, _response: unknown, next: () => Promise<void> | void) => next(),
    );
  });

  test("rejects unsigned requests", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/payment/onetime/webhook", {
        method: "POST",
        body: JSON.stringify({ id: "evt_unsigned" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: "Missing Stripe webhook signature.",
      code: "MISSING_STRIPE_SIGNATURE",
    });
  });

  test("rejects forged stripe signature with 401", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(
      new NextRequest("http://localhost/api/payment/onetime/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "bad-signature",
        },
        body: JSON.stringify({ id: "evt_forged", type: "checkout.session.completed" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Invalid signature" });
  });
});
