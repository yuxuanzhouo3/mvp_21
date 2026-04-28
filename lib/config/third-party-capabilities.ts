import { currentRegion, getPaymentProviders, isAuthFeatureSupported } from "@/lib/config/deployment.config";
import {
  getAppUrl,
  getWechatMiniAppId,
  getWechatMiniLoginPagePath,
  getWechatPayApiV3Key,
  getWechatPayAppId,
  getWechatMiniAppSecret,
} from "@/lib/config/runtime-env";

type Region = "CN" | "INTL";
type PaymentMethod = "stripe" | "paypal" | "wechat" | "alipay";
type AuthMethod = "sms" | "google" | "miniProgramWechat";

export interface CapabilityStatus {
  enabled: boolean;
  reason?: string;
}

export interface PublicAuthConfig {
  region: Region;
  features: {
    emailAuth: boolean;
    phoneOtpAuth: boolean;
    googleAuth: boolean;
    githubAuth: boolean;
  };
  availability: Record<AuthMethod, CapabilityStatus>;
}

export type OAuthReadinessStatus = "ready" | "not_ready" | "dashboard_check_required";

export interface OAuthProviderReadiness {
  enabled: boolean;
  status: OAuthReadinessStatus;
  reason?: string;
  checks: {
    envConfigured: boolean;
    expectedCallbackUrlConfigured: boolean;
    dashboardProviderVerified: boolean;
  };
  expectedCallbackUrl?: string;
}

export interface OAuthReadinessSnapshot {
  region: Region;
  providers: {
    google: OAuthProviderReadiness;
  };
}

export interface PaymentConfigSnapshot {
  region: Region;
  methods: Record<PaymentMethod, CapabilityStatus>;
  availableMethods: PaymentMethod[];
}

function isPresent(value?: string | null) {
  return Boolean(value && value.trim());
}

function isTruthy(value?: string | null) {
  if (!value) {
    return false;
  }

  return /^(1|true|yes)$/i.test(value.trim());
}

function looksLikeUrl(value?: string | null) {
  if (!isPresent(value)) {
    return false;
  }

  try {
    const parsed = new URL(value as string);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeMultilineSecret(value?: string | null) {
  return value?.replace(/\\n/g, "\n").trim() || "";
}

function createStatus(enabled: boolean, reason?: string): CapabilityStatus {
  return enabled ? { enabled: true } : { enabled: false, reason };
}

function isGoogleOAuthManagedByInfra(expectedCallbackUrl?: string) {
  const declaredManaged = isTruthy(process.env.SUPABASE_GOOGLE_OAUTH_MANAGED);
  if (!declaredManaged) {
    return false;
  }

  const callbackUrl = process.env.SUPABASE_GOOGLE_OAUTH_CALLBACK_URL;
  if (!looksLikeUrl(callbackUrl)) {
    return false;
  }

  if (expectedCallbackUrl && callbackUrl!.replace(/\/$/, "") !== expectedCallbackUrl.replace(/\/$/, "")) {
    return false;
  }

  return (
    isPresent(process.env.SUPABASE_GOOGLE_OAUTH_CLIENT_ID) &&
    isPresent(process.env.SUPABASE_GOOGLE_OAUTH_CLIENT_SECRET)
  );
}

function getSmsAuthStatus(region: Region): CapabilityStatus {
  if (region !== "CN" || !isAuthFeatureSupported("phoneOtpAuth")) {
    return createStatus(false, "SMS OTP sign-in is not supported in this deployment.");
  }

  if (!isPresent(process.env.TENCENT_SMS_APP_ID)) {
    return createStatus(false, "TENCENT_SMS_APP_ID is missing.");
  }

  if (!isPresent(process.env.TENCENT_SMS_SIGN_NAME)) {
    return createStatus(false, "TENCENT_SMS_SIGN_NAME is missing.");
  }

  if (!isPresent(process.env.TENCENT_SMS_TEMPLATE_ID)) {
    return createStatus(false, "TENCENT_SMS_TEMPLATE_ID is missing.");
  }

  if (!isPresent(process.env.TENCENT_SMS_SECRET_ID)) {
    return createStatus(false, "TENCENT_SMS_SECRET_ID is missing.");
  }

  if (!isPresent(process.env.TENCENT_SMS_SECRET_KEY)) {
    return createStatus(false, "TENCENT_SMS_SECRET_KEY is missing.");
  }

  return createStatus(true);
}

function getGoogleAuthStatus(region: Region): CapabilityStatus {
  if (region !== "INTL" || !isAuthFeatureSupported("googleAuth")) {
    return createStatus(false, "Google sign-in is not supported in this deployment.");
  }

  if (!looksLikeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return createStatus(false, "NEXT_PUBLIC_SUPABASE_URL is missing or invalid.");
  }

  if (!isPresent(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    return createStatus(false, "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
  }

  if (!looksLikeUrl(getAppUrl())) {
    return createStatus(false, "APP_URL or NEXT_PUBLIC_APP_URL is missing or invalid.");
  }

  return createStatus(true);
}

function getMiniProgramWechatStatus(region: Region): CapabilityStatus {
  if (region !== "CN") {
    return createStatus(
      false,
      "WeChat mini program sign-in is only supported in CN deployments.",
    );
  }

  if (!isPresent(getWechatMiniAppId())) {
    return createStatus(
      false,
      "WECHAT_MINIPROGRAM_APPID is missing.",
    );
  }

  if (!isPresent(getWechatMiniAppSecret())) {
    return createStatus(
      false,
      "WECHAT_MINIPROGRAM_SECRET is missing.",
    );
  }

  if (!isPresent(getWechatMiniLoginPagePath())) {
    return createStatus(
      false,
      "NEXT_PUBLIC_WECHAT_MINI_LOGIN_PAGE is missing.",
    );
  }

  return createStatus(true);
}

export function getPublicAuthConfig(): PublicAuthConfig {
  const region = currentRegion;
  const sms = getSmsAuthStatus(region);
  const google = getGoogleAuthStatus(region);
  const miniProgramWechat = getMiniProgramWechatStatus(region);

  return {
    region,
    features: {
      emailAuth: isAuthFeatureSupported("emailAuth"),
      phoneOtpAuth: sms.enabled,
      googleAuth: google.enabled,
      githubAuth: false,
    },
    availability: {
      sms,
      google,
      miniProgramWechat,
    },
  };
}

export function getOAuthReadinessSnapshot(): OAuthReadinessSnapshot {
  const region = currentRegion;
  const googleStatus = getGoogleAuthStatus(region);
  const appUrl = getAppUrl();
  const expectedCallbackUrl = looksLikeUrl(appUrl)
    ? `${appUrl.replace(/\/$/, "")}/auth/callback`
    : undefined;

  if (region !== "INTL" || !isAuthFeatureSupported("googleAuth")) {
    return {
      region,
      providers: {
        google: {
          enabled: false,
          status: "not_ready",
          reason: "Google sign-in is not supported in this deployment.",
          checks: {
            envConfigured: false,
            expectedCallbackUrlConfigured: Boolean(expectedCallbackUrl),
            dashboardProviderVerified: false,
          },
          expectedCallbackUrl,
        },
      },
    };
  }

  if (!googleStatus.enabled) {
    return {
      region,
      providers: {
        google: {
          enabled: false,
          status: "not_ready",
          reason: googleStatus.reason,
          checks: {
            envConfigured: false,
            expectedCallbackUrlConfigured: Boolean(expectedCallbackUrl),
            dashboardProviderVerified: false,
          },
          expectedCallbackUrl,
        },
      },
    };
  }

  const infraManaged = isGoogleOAuthManagedByInfra(expectedCallbackUrl);

  return {
    region,
    providers: {
      google: {
        enabled: true,
        status: infraManaged ? "ready" : "dashboard_check_required",
        reason: infraManaged
          ? "Google OAuth is declared as managed by infrastructure configuration."
          : "Environment variables are ready. Complete IaC rollout or verify provider toggle and redirect URLs in Supabase Dashboard. See docs/deployment/google-oauth-intl.md.",
        checks: {
          envConfigured: true,
          expectedCallbackUrlConfigured: Boolean(expectedCallbackUrl),
          dashboardProviderVerified: infraManaged,
        },
        expectedCallbackUrl,
      },
    },
  };
}

function getStripeStatus(region: Region): CapabilityStatus {
  if (region !== "INTL" || !getPaymentProviders().includes("stripe")) {
    return createStatus(false, "Stripe is not supported in this deployment.");
  }

  if (!/^sk_(test|live)_/i.test(process.env.STRIPE_SECRET_KEY || "")) {
    return createStatus(false, "STRIPE_SECRET_KEY is missing or invalid.");
  }

  if (!isPresent(process.env.STRIPE_WEBHOOK_SECRET)) {
    return createStatus(false, "STRIPE_WEBHOOK_SECRET is missing.");
  }

  if (!looksLikeUrl(getAppUrl())) {
    return createStatus(false, "APP_URL or NEXT_PUBLIC_APP_URL is missing or invalid.");
  }

  return createStatus(true);
}

function getPayPalStatus(region: Region): CapabilityStatus {
  if (region !== "INTL" || !getPaymentProviders().includes("paypal")) {
    return createStatus(false, "PayPal is not supported in this deployment.");
  }

  if (!isPresent(process.env.PAYPAL_CLIENT_ID)) {
    return createStatus(false, "PAYPAL_CLIENT_ID is missing.");
  }

  if (!isPresent(process.env.PAYPAL_CLIENT_SECRET)) {
    return createStatus(false, "PAYPAL_CLIENT_SECRET is missing.");
  }

  if (!looksLikeUrl(getAppUrl())) {
    return createStatus(false, "APP_URL or NEXT_PUBLIC_APP_URL is missing or invalid.");
  }

  return createStatus(true);
}

function getAlipayStatus(region: Region): CapabilityStatus {
  if (region !== "CN" || !getPaymentProviders().includes("alipay")) {
    return createStatus(false, "Alipay is not supported in this deployment.");
  }

  if (!isPresent(process.env.ALIPAY_APP_ID)) {
    return createStatus(false, "ALIPAY_APP_ID is missing.");
  }

  if (!normalizeMultilineSecret(process.env.ALIPAY_PRIVATE_KEY)) {
    return createStatus(false, "ALIPAY_PRIVATE_KEY is missing.");
  }

  const hasPublicKey =
    isPresent(process.env.ALIPAY_PUBLIC_KEY) ||
    isPresent(process.env.ALIPAY_ALIPAY_PUBLIC_KEY);
  const hasCertBundle =
    isPresent(process.env.ALIPAY_APP_CERT) &&
    isPresent(process.env.ALIPAY_ALIPAY_PUBLIC_CERT) &&
    isPresent(process.env.ALIPAY_ALIPAY_ROOT_CERT);

  if (!hasPublicKey && !hasCertBundle) {
    return createStatus(false, "Alipay public key or certificate bundle is missing.");
  }

  if (!looksLikeUrl(getAppUrl())) {
    return createStatus(false, "APP_URL or NEXT_PUBLIC_APP_URL is missing or invalid.");
  }

  return createStatus(true);
}

function getWechatPayStatus(region: Region): CapabilityStatus {
  if (region !== "CN" || !getPaymentProviders().includes("wechat")) {
    return createStatus(false, "WeChat Pay is not supported in this deployment.");
  }

  if (!isPresent(getWechatPayAppId())) {
    return createStatus(false, "WECHAT_APP_ID or NEXT_PUBLIC_WECHAT_APP_ID is missing.");
  }

  if (!isPresent(process.env.WECHAT_PAY_MCH_ID)) {
    return createStatus(false, "WECHAT_PAY_MCH_ID is missing.");
  }

  if (getWechatPayApiV3Key().length !== 32) {
    return createStatus(false, "WECHAT_PAY_API_V3_KEY must be 32 characters.");
  }

  if (!normalizeMultilineSecret(process.env.WECHAT_PAY_PRIVATE_KEY)) {
    return createStatus(false, "WECHAT_PAY_PRIVATE_KEY is missing.");
  }

  if (!isPresent(process.env.WECHAT_PAY_SERIAL_NO)) {
    return createStatus(false, "WECHAT_PAY_SERIAL_NO is missing.");
  }

  if (!looksLikeUrl(getAppUrl())) {
    return createStatus(false, "APP_URL or NEXT_PUBLIC_APP_URL is missing or invalid.");
  }

  return createStatus(true);
}

export function getPaymentConfigSnapshot(): PaymentConfigSnapshot {
  const region = currentRegion;
  const methods: Record<PaymentMethod, CapabilityStatus> = {
    stripe: getStripeStatus(region),
    paypal: getPayPalStatus(region),
    wechat: getWechatPayStatus(region),
    alipay: getAlipayStatus(region),
  };

  return {
    region,
    methods,
    availableMethods: (Object.entries(methods) as Array<[PaymentMethod, CapabilityStatus]>)
      .filter(([, status]) => status.enabled)
      .map(([method]) => method),
  };
}

export function getPaymentMethodStatus(method: PaymentMethod): CapabilityStatus {
  return getPaymentConfigSnapshot().methods[method];
}
