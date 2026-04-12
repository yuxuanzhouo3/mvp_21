import { z } from "zod";

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

  // PayPal配置
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live", "production"]).optional(),

  // PayPal计划ID
  PAYPAL_PRO_MONTHLY_PLAN_ID: z.string().optional(),
  PAYPAL_PRO_ANNUAL_PLAN_ID: z.string().optional(),
  PAYPAL_TEAM_MONTHLY_PLAN_ID: z.string().optional(),
  PAYPAL_TEAM_ANNUAL_PLAN_ID: z.string().optional(),
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
  const rawRegion =
    envData.NEXT_PUBLIC_APP_REGION ||
    envData.APP_REGION ||
    envData.NEXT_PUBLIC_DEPLOYMENT_REGION ||
    "CN";

  return rawRegion.toUpperCase() === "INTL" ? "INTL" : "CN";
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
    const conditionalErrors: string[] = [];

    if (region === "INTL") {
      if (!envData.NEXT_PUBLIC_SUPABASE_URL) {
        conditionalErrors.push(
          "NEXT_PUBLIC_SUPABASE_URL: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is INTL"
        );
      }

      if (!envData.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        conditionalErrors.push(
          "NEXT_PUBLIC_SUPABASE_ANON_KEY: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is INTL"
        );
      }

      if (!envData.SUPABASE_SERVICE_ROLE_KEY) {
        conditionalErrors.push(
          "SUPABASE_SERVICE_ROLE_KEY: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is INTL"
        );
      }
    }

    if (region === "CN") {
      if (!envData.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID) {
        conditionalErrors.push(
          "NEXT_PUBLIC_WECHAT_CLOUDBASE_ID: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.CLOUDBASE_SECRET_ID) {
        conditionalErrors.push(
          "CLOUDBASE_SECRET_ID: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.CLOUDBASE_SECRET_KEY) {
        conditionalErrors.push(
          "CLOUDBASE_SECRET_KEY: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.TENCENT_SMS_APP_ID) {
        conditionalErrors.push(
          "TENCENT_SMS_APP_ID: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.TENCENT_SMS_SIGN_NAME) {
        conditionalErrors.push(
          "TENCENT_SMS_SIGN_NAME: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.TENCENT_SMS_TEMPLATE_ID) {
        conditionalErrors.push(
          "TENCENT_SMS_TEMPLATE_ID: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.TENCENT_SMS_SECRET_ID) {
        conditionalErrors.push(
          "TENCENT_SMS_SECRET_ID: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }

      if (!envData.TENCENT_SMS_SECRET_KEY) {
        conditionalErrors.push(
          "TENCENT_SMS_SECRET_KEY: Required when APP_REGION/NEXT_PUBLIC_APP_REGION is CN"
        );
      }
    }

    if (
      region === "CN" &&
      envData.NODE_ENV === "production" &&
      !envData.JWT_SECRET?.trim()
    ) {
      conditionalErrors.push(
        "JWT_SECRET: Required in production when APP_REGION/NEXT_PUBLIC_APP_REGION resolves to CN"
      );
    }

    const wechatPayKey =
      envData.WECHAT_PAY_API_V3_KEY || envData.WECHAT_PAY_API_KEY_V3;
    if (wechatPayKey && wechatPayKey.trim().length !== 32) {
      conditionalErrors.push(
        "WECHAT_PAY_API_V3_KEY: When provided, it must contain exactly 32 characters"
      );
    }

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
    "PAYPAL_CLIENT_SECRET",
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
