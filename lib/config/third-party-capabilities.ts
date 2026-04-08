import { currentRegion, getPaymentProviders, isAuthFeatureSupported } from "@/lib/config/deployment.config";
import {
  getAppUrl,
  getPayPalMode,
  getWechatOAuthAppId,
  getWechatPayApiV3Key,
  getWechatPayAppId,
} from "@/lib/config/runtime-env";

type Region = "CN" | "INTL";
type PaymentMethod = "stripe" | "paypal" | "wechat" | "alipay";
type AuthMethod = "wechat" | "google";

export interface CapabilityStatus {
  enabled: boolean;
  reason?: string;
}

export interface PublicAuthConfig {
  region: Region;
  features: {
    emailAuth: boolean;
    wechatAuth: boolean;
    googleAuth: boolean;
    githubAuth: boolean;
  };
  availability: Record<AuthMethod, CapabilityStatus>;
}

export interface PaymentConfigSnapshot {
  region: Region;
  methods: Record<PaymentMethod, CapabilityStatus>;
  availableMethods: PaymentMethod[];
}

function isPresent(value?: string | null) {
  return Boolean(value && value.trim());
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

function getWechatAuthStatus(region: Region): CapabilityStatus {
  if (region !== "CN" || !isAuthFeatureSupported("wechatAuth")) {
    return createStatus(false, "WeChat sign-in is not supported in this deployment.");
  }

  if (!isPresent(getWechatOAuthAppId())) {
    return createStatus(false, "NEXT_PUBLIC_WECHAT_APP_ID or WECHAT_APP_ID is missing.");
  }

  if (!looksLikeUrl(getAppUrl())) {
    return createStatus(false, "APP_URL or NEXT_PUBLIC_APP_URL is missing or invalid.");
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

export function getPublicAuthConfig(): PublicAuthConfig {
  const region = currentRegion;
  const wechat = getWechatAuthStatus(region);
  const google = getGoogleAuthStatus(region);

  return {
    region,
    features: {
      emailAuth: isAuthFeatureSupported("emailAuth"),
      wechatAuth: wechat.enabled,
      googleAuth: google.enabled,
      githubAuth: false,
    },
    availability: {
      wechat,
      google,
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

  if (!isPresent(process.env.PAYPAL_WEBHOOK_ID)) {
    return createStatus(false, "PAYPAL_WEBHOOK_ID is missing.");
  }

  const payPalMode = getPayPalMode();
  if (!["sandbox", "live"].includes(payPalMode)) {
    return createStatus(false, "PAYPAL_ENVIRONMENT or PAYPAL_MODE is invalid.");
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
