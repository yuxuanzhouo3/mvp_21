import { afterEach, describe, expect, jest, test } from "@jest/globals";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
  jest.resetModules();
  jest.clearAllMocks();
});

describe("supabase runtime env guard", () => {
  test("throws in INTL production when required public keys are missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    jest.doMock("@/lib/config/deployment.config", () => ({
      isInternationalDeployment: () => true,
    }));

    const runtime = await import("@/lib/config/supabase-runtime");

    expect(() =>
      runtime.assertSupabaseRuntimeEnv({
        context: "unit-test",
      }),
    ).toThrow(/Missing Supabase runtime env/);
  });

  test("warns in non-strict mode but returns parsed env", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.doMock("@/lib/config/deployment.config", () => ({
      isInternationalDeployment: () => false,
    }));

    const runtime = await import("@/lib/config/supabase-runtime");
    const result = runtime.assertSupabaseRuntimeEnv({
      context: "unit-test-dev",
    });

    expect(result.strictMode).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});

