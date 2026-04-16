import { afterEach, describe, expect, jest, test } from "@jest/globals";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  jest.clearAllMocks();
});

describe("oauth readiness snapshot", () => {
  test("returns dashboard_check_required when INTL Google env is ready", async () => {
    process.env.APP_URL = "https://www.mornhub.quest";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    jest.doMock("@/lib/config/deployment.config", () => ({
      currentRegion: "INTL",
      getPaymentProviders: () => ["stripe"],
      isAuthFeatureSupported: (feature: string) => feature === "googleAuth",
    }));

    const capabilities = await import("@/lib/config/third-party-capabilities");
    const snapshot = capabilities.getOAuthReadinessSnapshot();

    expect(snapshot.providers.google.status).toBe("dashboard_check_required");
    expect(snapshot.providers.google.checks.envConfigured).toBe(true);
    expect(snapshot.providers.google.expectedCallbackUrl).toBe(
      "https://www.mornhub.quest/auth/callback",
    );
  });

  test("returns not_ready when INTL Google env is incomplete", async () => {
    process.env.APP_URL = "https://www.mornhub.quest";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    jest.doMock("@/lib/config/deployment.config", () => ({
      currentRegion: "INTL",
      getPaymentProviders: () => ["stripe"],
      isAuthFeatureSupported: (feature: string) => feature === "googleAuth",
    }));

    const capabilities = await import("@/lib/config/third-party-capabilities");
    const snapshot = capabilities.getOAuthReadinessSnapshot();

    expect(snapshot.providers.google.status).toBe("not_ready");
    expect(snapshot.providers.google.reason).toMatch(/NEXT_PUBLIC_SUPABASE_URL/i);
  });
});
