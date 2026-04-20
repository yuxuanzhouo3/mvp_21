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

export function getWechatPayMerchantId(): string {
  return pickFirstNonEmpty(process.env.WECHAT_PAY_MCH_ID);
}

export function getWechatPayPrivateKey(): string {
  return pickFirstNonEmpty(process.env.WECHAT_PAY_PRIVATE_KEY);
}

export function getWechatPaySerialNo(): string {
  return pickFirstNonEmpty(process.env.WECHAT_PAY_SERIAL_NO);
}

export function getCloudBaseEnvId(): string {
  return pickFirstNonEmpty(
    process.env.CLOUDBASE_ENV_ID,
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
  );
}

export function getWechatPayPlatformPublicKey(): string {
  return pickFirstNonEmpty(
    process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY,
    process.env.WECHAT_PAY_PUBLIC_KEY,
  );
}

export function getDashScopeBaseUrl(): string {
  return pickFirstNonEmpty(
    process.env.AI_BASE_URL,
    process.env.DASHSCOPE_BASE_URL,
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  );
}

export function getOpenAIBaseUrl(): string {
  return pickFirstNonEmpty(
    process.env.AI_BASE_URL,
    process.env.OPENAI_BASE_URL,
    process.env.DASHSCOPE_BASE_URL,
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  );
}

export function getQwenModel(): string {
  return pickFirstNonEmpty(
    process.env.AI_MODEL,
    process.env.QWEN_MODEL,
    "qwen-plus",
  );
}

export function getOpenAIModel(): string {
  return pickFirstNonEmpty(
    process.env.AI_MODEL,
    process.env.OPENAI_MODEL,
    process.env.QWEN_MODEL,
    "qwen-plus",
  );
}

export function getUnifiedAIApiKey(): string {
  return pickFirstNonEmpty(
    process.env.AI_API_KEY,
    process.env.DASHSCOPE_API_KEY,
    process.env.OPENAI_API_KEY,
  );
}

export function getUnifiedAIBaseUrl(): string {
  return pickFirstNonEmpty(
    process.env.AI_BASE_URL,
    process.env.DASHSCOPE_BASE_URL,
    process.env.OPENAI_BASE_URL,
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
  );
}

export function getUnifiedAIModel(): string {
  return pickFirstNonEmpty(
    process.env.AI_MODEL,
    process.env.QWEN_MODEL,
    process.env.OPENAI_MODEL,
    "qwen-plus",
  );
}
