import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockValidateEnvironment = jest.fn();
const mockCheckSensitiveDataExposure = jest.fn();
const mockIsInternationalDeployment = jest.fn();

jest.mock("@/lib/validation/env-validation", () => ({
  validateEnvironment: () => mockValidateEnvironment(),
  checkSensitiveDataExposure: () => mockCheckSensitiveDataExposure(),
}));

jest.mock("@/lib/config/deployment.config", () => ({
  isInternationalDeployment: () => mockIsInternationalDeployment(),
}));

import { performStartupSecurityChecks } from "@/lib/monitoring/startup-checks";

describe("startup security checks payment provider detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateEnvironment.mockReturnValue({ success: true, errors: [] });
    mockCheckSensitiveDataExposure.mockReturnValue({ safe: true, warnings: [] });
    process.env = {
      NODE_ENV: "production",
      APP_URL: "https://example.com",
    } as NodeJS.ProcessEnv;
  });

  test("does not warn when CN payment providers are configured", () => {
    mockIsInternationalDeployment.mockReturnValue(false);
    process.env.WECHAT_PAY_MCH_ID = "mch-id";
    process.env.WECHAT_PAY_API_V3_KEY = "wechat-v3-key";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    performStartupSecurityChecks();

    expect(warnSpy).not.toHaveBeenCalledWith(
      "⚠️  No payment providers configured in production",
    );
    warnSpy.mockRestore();
  });

  test("warns when INTL payment providers are missing", () => {
    mockIsInternationalDeployment.mockReturnValue(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    performStartupSecurityChecks();

    expect(warnSpy).toHaveBeenCalledWith(
      "⚠️  No payment providers configured in production",
    );
    warnSpy.mockRestore();
  });
});
