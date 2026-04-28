import { afterEach, describe, expect, jest, test } from "@jest/globals";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
  jest.clearAllMocks();
});

describe("wechat mini runtime config", () => {
  test("runtime env supports mvp_25 mini program env names", async () => {
    delete process.env.WECHAT_MINI_APP_ID;
    delete process.env.WECHAT_MINI_APP_SECRET;
    process.env.WECHAT_MINIPROGRAM_APPID = "mvp25-mini-app-id";
    process.env.WECHAT_MINIPROGRAM_SECRET = "mvp25-mini-secret";

    const runtimeEnv = await import("@/lib/config/runtime-env");

    expect(runtimeEnv.getWechatMiniAppId()).toBe("mvp25-mini-app-id");
    expect(runtimeEnv.getWechatMiniAppSecret()).toBe("mvp25-mini-secret");
  });

  test("public auth config exposes mini program wechat readiness in CN", async () => {
    process.env.WECHAT_MINIPROGRAM_APPID = "mini-app-id";
    process.env.WECHAT_MINIPROGRAM_SECRET = "mini-app-secret";
    delete process.env.WECHAT_MINI_APP_ID;
    delete process.env.WECHAT_MINI_APP_SECRET;
    process.env.TENCENT_SMS_APP_ID = "sms-app-id";
    process.env.TENCENT_SMS_SIGN_NAME = "sms-sign";
    process.env.TENCENT_SMS_TEMPLATE_ID = "sms-template";
    process.env.TENCENT_SMS_SECRET_ID = "sms-secret-id";
    process.env.TENCENT_SMS_SECRET_KEY = "sms-secret-key";

    jest.doMock("@/lib/config/deployment.config", () => ({
      currentRegion: "CN",
      getPaymentProviders: () => ["wechat"],
      isAuthFeatureSupported: (feature: string) =>
        feature === "emailAuth" || feature === "phoneOtpAuth",
    }));

    const capabilities = await import("@/lib/config/third-party-capabilities");
    const authConfig = capabilities.getPublicAuthConfig();

    expect(authConfig.availability.sms.enabled).toBe(true);
    expect(authConfig.availability.miniProgramWechat.enabled).toBe(true);
  });

  test("public auth config reports missing mini program config in CN", async () => {
    delete process.env.WECHAT_MINI_APP_ID;
    delete process.env.WECHAT_MINI_APP_SECRET;
    delete process.env.WECHAT_MINIPROGRAM_APPID;
    delete process.env.WECHAT_MINIPROGRAM_SECRET;

    jest.doMock("@/lib/config/deployment.config", () => ({
      currentRegion: "CN",
      getPaymentProviders: () => ["wechat"],
      isAuthFeatureSupported: () => false,
    }));

    const capabilities = await import("@/lib/config/third-party-capabilities");
    const authConfig = capabilities.getPublicAuthConfig();

    expect(authConfig.availability.miniProgramWechat.enabled).toBe(false);
    expect(authConfig.availability.miniProgramWechat.reason).toMatch(
      /WECHAT_MINIPROGRAM_APPID/i,
    );
  });

  test("env validation accepts mvp_25 mini program env names", async () => {
    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID = "cloudbase-env-id";
    process.env.CLOUDBASE_SECRET_ID = "cloudbase-secret-id";
    process.env.CLOUDBASE_SECRET_KEY = "cloudbase-secret-key";
    process.env.TENCENT_SMS_APP_ID = "sms-app-id";
    process.env.TENCENT_SMS_SIGN_NAME = "sms-sign";
    process.env.TENCENT_SMS_TEMPLATE_ID = "sms-template";
    process.env.TENCENT_SMS_SECRET_ID = "sms-secret-id";
    process.env.TENCENT_SMS_SECRET_KEY = "sms-secret-key";
    process.env.DASHSCOPE_API_KEY = "dashscope-key";
    delete process.env.WECHAT_MINI_APP_ID;
    delete process.env.WECHAT_MINI_APP_SECRET;
    process.env.WECHAT_MINIPROGRAM_APPID = "mvp25-mini-app-id";
    process.env.WECHAT_MINIPROGRAM_SECRET = "mvp25-mini-secret";

    const { validateEnvironment } = await import("@/lib/validation/env-validation");
    const result = validateEnvironment();

    expect(result.success).toBe(true);
  });
});
