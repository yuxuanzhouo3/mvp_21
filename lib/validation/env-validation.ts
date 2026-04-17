import { z } from "zod";
import { resolveDeploymentRegion } from "@/lib/config/deployment-region";

// 环境变量验证schema
const envSchema = z.object({
  // 基础配置
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_NAME: z.string().min(1).default("MornContract"),
  APP_REGION: z.enum(["CN", "INTL"]).optional(),
  NEXT_PUBLIC_APP_REGION: z.enum(["CN", "INTL"]).optional(),
  NEXT_PUBLIC_DEPLOYMENT_REGION: z.enum(["CN", "INTL"]).optional(),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_WECHAT_CLOUDBASE_ID: z.string().min(1).optional(),
  CLOUDBASE_SECRET_ID: z.string().min(1).optional(),
  CLOUDBASE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_WECHAT_APP_ID: z.string().min(1).optional(),
  WECHAT_APP_ID: z.string().min(1).optional(),
  WECHAT_APP_SECRET: z.string().min(1).optional(),
  TENCENT_SMS_APP_ID: z.string().min(1).optional(),
  TENCENT_SMS_SIGN_NAME: z.string().min(1).optional(),
  TENCENT_SMS_TEMPLATE_ID: z.string().min(1).optional(),
  TENCENT_SMS_SECRET_ID: z.string().min(1).optional(),
  TENCENT_SMS_SECRET_KEY: z.string().min(1).optional(),
  TENCENT_SMS_REGION: z.string().min(1).optional(),

  // Supabase配置
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_SMTP_HOST: z.string().min(1).optional(),
  AUTH_EMAIL_SMTP_PORT: z.string().regex(/^\d+$/).optional(),
  AUTH_EMAIL_SMTP_SECURE: z.enum(["true", "false"]).optional(),
  AUTH_EMAIL_SMTP_USER: z.string().min(1).optional(),
  AUTH_EMAIL_SMTP_PASS: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().min(1).optional(),

  // Stripe配置
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .regex(/^pk_(test|live)_/)
    .optional(),
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_/)
    .optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Stripe价格ID
  STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_PRO_ANNUAL_PRICE_ID: z.string().optional(),
  STRIPE_TEAM_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_TEAM_ANNUAL_PRICE_ID: z.string().optional(),

  ALIPAY_APP_ID: z.string().optional(),
  ALIPAY_PRIVATE_KEY: z.string().optional(),
  ALIPAY_PUBLIC_KEY: z.string().optional(),
  ALIPAY_ALIPAY_PUBLIC_KEY: z.string().optional(),
  ALIPAY_APP_CERT: z.string().optional(),
  ALIPAY_ALIPAY_PUBLIC_CERT: z.string().optional(),
  ALIPAY_ALIPAY_ROOT_CERT: z.string().optional(),
  ALIPAY_CERT_MODE: z.string().optional(),
  WECHAT_PAY_MCH_ID: z.string().optional(),
  WECHAT_PAY_API_V3_KEY: z.string().optional(),
  WECHAT_PAY_API_KEY_V3: z.string().optional(),
  WECHAT_PAY_SERIAL_NO: z.string().optional(),
  WECHAT_PAY_PRIVATE_KEY: z.string().optional(),

  // AI提供商配置
  OPENAI_API_KEY: z.string().regex(/^sk-/).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  AI_ANALYZE_SOFT_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  AI_ANALYZE_INPUT_MAX_CHARS: z.string().regex(/^\d+$/).optional(),
  AI_ANALYZE_MAX_TOKENS: z.string().regex(/^\d+$/).optional(),
  AI_ANALYZE_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  AI_ANALYZE_ROUTE_BUDGET_MS: z.string().regex(/^\d+$/).optional(),
  AI_PROVIDER_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  AI_GENERATE_SOFT_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  AI_GENERATE_TIME_BUDGET_MS: z.string().regex(/^\d+$/).optional(),
  AI_GENERATE_MAX_TOKENS: z.string().regex(/^\d+$/).optional(),
  AI_GENERATE_ROUTE_BUDGET_MS: z.string().regex(/^\d+$/).optional(),
  AI_CHAT_SOFT_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  AI_CHAT_ROUTE_BUDGET_MS: z.string().regex(/^\d+$/).optional(),
  AUTH_VERIFY_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  MEMBERSHIP_PROFILE_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  MEMBERSHIP_SETTINGS_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  OCR_SOFT_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  OCR_ROUTE_BUDGET_MS: z.string().regex(/^\d+$/).optional(),
  OCR_PROVIDER_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  CONTRACTS_LIST_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  CONTRACTS_CREATE_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  CONTRACTS_QUOTA_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  CONTRACTS_QUERY_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  CONTRACTS_ENQUEUE_TIMEOUT_MS: z.string().regex(/^\d+$/).optional(),
  OPENAI_ORG_ID: z.string().optional(),
  ANTHROPIC_API_KEY: z
    .string()
    .regex(/^sk-ant-/)
    .optional(),
  DASHSCOPE_API_KEY: z.string().optional(), // 阿里云通义千问
  DASHSCOPE_BASE_URL: z.string().url().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(), // Vercel AI Gateway

  // 地理分流配置
  ALLOWED_ORIGINS: z.string().optional(),
  DOMESTIC_SYSTEM_URL: z.string().url().optional(),
  INTERNATIONAL_SYSTEM_URL: z.string().url().optional(),

  // 监控配置
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z
    .string()
    .regex(/^\d*\.?\d+$/)
    .optional(),

  // Vercel配置
  VERCEL_URL: z.string().optional(),
});

function resolveRegion(envData: Record<string, string | undefined>): "CN" | "INTL" {
  return resolveDeploymentRegion(envData).region;
}

function isPlaceholderValue(value?: string): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const placeholderTokens = [
    "replace_me",
    "replace-me",
    "replace-with",
    "your-",
    "your_",
    "your ",
    "example",
    "placeholder",
    "changeme",
    "todo",
    "dummy",
  ];

  return placeholderTokens.some((token) => normalized.includes(token));
}

function validateProductionPlaceholderValues(
  envData: Record<string, string | undefined>,
): string[] {
  if ((envData.NODE_ENV || "development") !== "production") {
    return [];
  }

  const errors: string[] = [];
  const pushIfPlaceholder = (key: string, message?: string) => {
    if (isPlaceholderValue(envData[key])) {
      errors.push(message || `${key}: placeholder value is not allowed in production`);
    }
  };

  pushIfPlaceholder("NEXT_PUBLIC_SUPABASE_URL");
  pushIfPlaceholder("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  pushIfPlaceholder("SUPABASE_SERVICE_ROLE_KEY");
  pushIfPlaceholder("OPENAI_API_KEY");
  pushIfPlaceholder("APP_URL");
  pushIfPlaceholder("NEXT_PUBLIC_APP_URL");
  pushIfPlaceholder("ALIPAY_APP_ID");

  if ((envData.STRIPE_SECRET_KEY || "").startsWith("sk_test_")) {
    errors.push("STRIPE_SECRET_KEY: sk_test_ keys are not allowed in production");
  }

  if ((envData.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").startsWith("pk_test_")) {
    errors.push(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_ keys are not allowed in production",
    );
  }

  const alipayGateway = (envData.ALIPAY_GATEWAY_URL || "").toLowerCase();
  if (alipayGateway.includes("sandbox") || alipayGateway.includes("alipaydev.com")) {
    errors.push("ALIPAY_GATEWAY_URL: sandbox gateway is not allowed in production");
  }

  return errors;
}

/**
 * 验证环境变量
 */
export function validateEnvironment():
  | { success: true }
  | { success: false; errors: string[] } {
  try {
    const envData: Record<string, string | undefined> = {};

    // 收集所有环境变量
    for (const key in process.env) {
      envData[key] = process.env[key];
    }

    const result = envSchema.safeParse(envData);

    if (!result.success) {
      const errors = result.error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      );
      return { success: false, errors };
    }

    const region = resolveRegion(envData);
    const regionResolution = resolveDeploymentRegion(envData);
    const conditionalErrors: string[] = [];

    if (regionResolution.deprecatedSourceUsed) {
      console.warn(
        `[env] ${regionResolution.source} is deprecated. Use NEXT_PUBLIC_DEPLOYMENT_REGION.`,
      );
    }

    if (region === "INTL") {
      if (!envData.NEXT_PUBLIC_SUPABASE_URL) {
        conditionalErrors.push(
          "NEXT_PUBLIC_SUPABASE_URL: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to INTL"
        );
      }

      if (!envData.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        conditionalErrors.push(
          "NEXT_PUBLIC_SUPABASE_ANON_KEY: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to INTL"
        );
      }

      if (!envData.SUPABASE_SERVICE_ROLE_KEY) {
        conditionalErrors.push(
          "SUPABASE_SERVICE_ROLE_KEY: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to INTL"
        );
      }

      const openAiModel = envData.OPENAI_MODEL?.trim();
      if (!openAiModel) {
        conditionalErrors.push(
          "OPENAI_MODEL: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to INTL"
        );
      } else if (!/^gpt-4/i.test(openAiModel)) {
        conditionalErrors.push(
          "OPENAI_MODEL: Must be an explicit GPT-4 series model when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to INTL"
        );
      }
    }

    if (region === "CN") {
      if (!envData.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID) {
        conditionalErrors.push(
          "NEXT_PUBLIC_WECHAT_CLOUDBASE_ID: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.CLOUDBASE_SECRET_ID) {
        conditionalErrors.push(
          "CLOUDBASE_SECRET_ID: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.CLOUDBASE_SECRET_KEY) {
        conditionalErrors.push(
          "CLOUDBASE_SECRET_KEY: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.TENCENT_SMS_APP_ID) {
        conditionalErrors.push(
          "TENCENT_SMS_APP_ID: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.TENCENT_SMS_SIGN_NAME) {
        conditionalErrors.push(
          "TENCENT_SMS_SIGN_NAME: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.TENCENT_SMS_TEMPLATE_ID) {
        conditionalErrors.push(
          "TENCENT_SMS_TEMPLATE_ID: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.TENCENT_SMS_SECRET_ID) {
        conditionalErrors.push(
          "TENCENT_SMS_SECRET_ID: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }

      if (!envData.TENCENT_SMS_SECRET_KEY) {
        conditionalErrors.push(
          "TENCENT_SMS_SECRET_KEY: Required when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
        );
      }
    }

    if (
      region === "CN" &&
      envData.NODE_ENV === "production" &&
      !envData.JWT_SECRET?.trim()
    ) {
      conditionalErrors.push(
        "JWT_SECRET: Required in production when NEXT_PUBLIC_DEPLOYMENT_REGION resolves to CN"
      );
    }

    const wechatPayKey =
      envData.WECHAT_PAY_API_V3_KEY || envData.WECHAT_PAY_API_KEY_V3;
    if (wechatPayKey && wechatPayKey.trim().length !== 32) {
      conditionalErrors.push(
        "WECHAT_PAY_API_V3_KEY: When provided, it must contain exactly 32 characters"
      );
    }

    conditionalErrors.push(...validateProductionPlaceholderValues(envData));

    if (conditionalErrors.length > 0) {
      return { success: false, errors: conditionalErrors };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Environment validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
    };
  }
}

/**
 * 获取验证后的环境变量
 */
export function getValidatedEnv(): z.infer<typeof envSchema> {
  const validation = validateEnvironment();
  if (!validation.success) {
    throw new Error(
      `Environment validation failed:\n${validation.errors.join("\n")}`
    );
  }

  return envSchema.parse(process.env);
}

/**
 * 检查敏感信息泄露风险
 */
export function checkSensitiveDataExposure(): {
  safe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // 检查是否在客户端代码中暴露了敏感信息
  const sensitiveKeys = [
    "STRIPE_SECRET_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DASHSCOPE_API_KEY",
    "AI_GATEWAY_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TENCENT_SMS_SECRET_ID",
    "TENCENT_SMS_SECRET_KEY",
    "SENTRY_DSN", // 虽然DSN是公开的，但仍需检查
  ];

  for (const key of sensitiveKeys) {
    if (process.env[key] && typeof window !== "undefined") {
      warnings.push(
        `Sensitive environment variable ${key} is accessible in browser context`
      );
    }
  }

  // 检查API密钥格式
  if (
    process.env.STRIPE_SECRET_KEY &&
    !process.env.STRIPE_SECRET_KEY.startsWith("sk_")
  ) {
    warnings.push("Stripe secret key does not have expected format");
  }

  if (
    process.env.OPENAI_API_KEY &&
    !process.env.OPENAI_API_KEY.startsWith("sk-")
  ) {
    warnings.push("OpenAI API key does not have expected format");
  }

  return { safe: warnings.length === 0, warnings };
}

/**
 * 加密敏感配置存储（概念实现）
 * 注意：这只是一个示例，实际实现需要更安全的加密方案
 */
export class SecureConfig {
  private static encryptedConfigs = new Map<string, string>();

  static storeSecure(key: string, value: string): void {
    // 在生产环境中，这里应该使用真正的加密
    // 这里只是一个占位符实现
    const encrypted = Buffer.from(value).toString("base64");
    this.encryptedConfigs.set(key, encrypted);
  }

  static getSecure(key: string): string | null {
    const encrypted = this.encryptedConfigs.get(key);
    if (!encrypted) return null;

    // 在生产环境中，这里应该使用真正的解密
    return Buffer.from(encrypted, "base64").toString();
  }
}
