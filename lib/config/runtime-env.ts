function pickFirstNonEmpty(
  ...values: Array<string | undefined | null>
): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function getAppUrl(): string {
  return pickFirstNonEmpty(
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  );
}

export function getWechatOAuthAppId(): string {
  return pickFirstNonEmpty(
    process.env.NEXT_PUBLIC_WECHAT_APP_ID,
    process.env.WECHAT_APP_ID,
  );
}

export function getWechatPayAppId(): string {
  return pickFirstNonEmpty(
    process.env.WECHAT_APP_ID,
    process.env.NEXT_PUBLIC_WECHAT_APP_ID,
  );
}

export function getWechatPayApiV3Key(): string {
  return pickFirstNonEmpty(
    process.env.WECHAT_PAY_API_V3_KEY,
    process.env.WECHAT_PAY_API_KEY_V3,
  );
}

export function getWechatPayPlatformPublicKey(): string {
  return pickFirstNonEmpty(
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY,
    process.env.WECHAT_PAY_PUBLIC_KEY,
  );
}

export function getPayPalEnvironment(): "sandbox" | "production" {
  const raw = pickFirstNonEmpty(
    process.env.PAYPAL_ENVIRONMENT,
    process.env.PAYPAL_MODE,
  ).toLowerCase();

  return raw === "live" || raw === "production" ? "production" : "sandbox";
}

export function getPayPalMode(): "sandbox" | "live" {
  return getPayPalEnvironment() === "production" ? "live" : "sandbox";
}

export function getDashScopeBaseUrl(): string {
  return pickFirstNonEmpty(
    process.env.DASHSCOPE_BASE_URL,
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  );
}

export function getOpenAIBaseUrl(): string {
  return pickFirstNonEmpty(
    process.env.OPENAI_BASE_URL,
    "https://api.openai.com/v1",
  );
}

export function getQwenModel(): string {
  return pickFirstNonEmpty(
    process.env.QWEN_MODEL,
    "qwen-plus",
  );
}

export function getOpenAIModel(): string {
  const baseUrl = getOpenAIBaseUrl().toLowerCase();
  const defaultModel = baseUrl.includes("dashscope.aliyuncs.com")
    ? "qwen-plus"
    : "gpt-4.1-mini";

  return pickFirstNonEmpty(
    process.env.OPENAI_MODEL,
    defaultModel,
  );
}
