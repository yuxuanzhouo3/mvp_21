import { describe, expect, test } from "@jest/globals";

import {
  buildSubscriptionPaymentFields,
  extractSubscriptionOrderMetadata,
} from "@/lib/payment/subscription-payment-sync";

describe("payment governance mainline coverage", () => {
  test("subscription payment fields build a normalized yearly product payload", () => {
    const fields = buildSubscriptionPaymentFields({
      planType: "enterprise",
      billingCycle: "yearly",
      days: 365,
    });

    expect(fields.billing_cycle).toBe("yearly");
    expect(fields.product_type).toBe("subscription");
    expect(fields.product_name).toBe("Enterprise Yearly Subscription");
    expect(fields.metadata).toEqual({
      planType: "enterprise",
      billingCycle: "yearly",
      days: 365,
      productType: "subscription",
      productName: "Enterprise Yearly Subscription",
    });
  });

  test("legacy payment metadata is normalized into the unified subscription order shape", () => {
    const metadata = extractSubscriptionOrderMetadata({
      _id: "payment-1",
      user_id: "user-1",
      billing_cycle: "annual",
      product_name: "",
      metadata: {
        planType: "pro",
        days: "365",
      },
    });

    expect(metadata.planType).toBe("pro");
    expect(metadata.billingCycle).toBe("yearly");
    expect(metadata.days).toBe(365);
    expect(metadata.productType).toBe("subscription");
    expect(metadata.productName).toBe("Pro Yearly Subscription");
  });

  test("missing subscription metadata is rejected instead of silently building invalid orders", () => {
    expect(() =>
      extractSubscriptionOrderMetadata({
        _id: "payment-2",
        user_id: "user-2",
        metadata: {},
      }),
    ).toThrow("Missing subscription order metadata");
  });
});
