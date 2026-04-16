import { afterEach, describe, expect, jest, test } from "@jest/globals";

const OLD_ENV = { ...process.env };

async function loadCapabilities(region: "CN" | "INTL") {
  jest.resetModules();

  process.env.APP_URL = "https://example.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

  jest.doMock("@/lib/config/deployment.config", () => ({
    currentRegion: region,
    getPaymentProviders: () =>
      region === "CN" ? ["wechat", "alipay"] : ["stripe"],
    isAuthFeatureSupported: (feature: string) => {
      if (feature === "emailAuth") return true;
      if (feature === "wechatAuth") return region === "CN";
      if (feature === "googleAuth") return region === "INTL";
      return false;
    },
  }));

  jest.doMock("@/lib/config/runtime-env", () => ({
    getAppUrl: () => "https://example.com",
    getWechatOAuthAppId: () => "wx-app-id",
    getWechatPayApiV3Key: () => "1".repeat(32),
    getWechatPayAppId: () => "wx-app-id",
  }));

  return import("@/lib/config/third-party-capabilities");
}

afterEach(() => {
  process.env = { ...OLD_ENV };
  jest.resetModules();
  jest.clearAllMocks();
});

describe("region dual-stack capability matrix", () => {
  test("CN region keeps stripe marked as unsupported", async () => {
    const caps = await loadCapabilities("CN");
    const paymentSnapshot = caps.getPaymentConfigSnapshot();
    const authSnapshot = caps.getPublicAuthConfig();

    expect(paymentSnapshot.region).toBe("CN");
    expect(paymentSnapshot.methods.stripe.enabled).toBe(false);
    expect(paymentSnapshot.methods.stripe.reason).toContain("not supported");

    expect(authSnapshot.region).toBe("CN");
    expect(authSnapshot.availability.google.enabled).toBe(false);
    expect(authSnapshot.availability.google.reason).toContain("not supported");
  });

  test("INTL region keeps wechat/alipay marked as unsupported", async () => {
    const caps = await loadCapabilities("INTL");
    const paymentSnapshot = caps.getPaymentConfigSnapshot();
    const authSnapshot = caps.getPublicAuthConfig();

    expect(paymentSnapshot.region).toBe("INTL");
    expect(paymentSnapshot.methods.wechat.enabled).toBe(false);
    expect(paymentSnapshot.methods.wechat.reason).toContain("not supported");
    expect(paymentSnapshot.methods.alipay.enabled).toBe(false);
    expect(paymentSnapshot.methods.alipay.reason).toContain("not supported");

    expect(authSnapshot.region).toBe("INTL");
    expect(authSnapshot.availability.wechat.enabled).toBe(false);
    expect(authSnapshot.availability.wechat.reason).toContain("not supported");
  });
});
