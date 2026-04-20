import {
  validateEnvironment,
  checkSensitiveDataExposure,
} from "@/lib/validation/env-validation";
import { isInternationalDeployment } from "@/lib/config/deployment.config";

function isStrictProductionRuntime(): boolean {
  const vercelEnv = (process.env.VERCEL_ENV || "").toLowerCase();
  if (vercelEnv) {
    return vercelEnv === "production";
  }

  return process.env.NODE_ENV === "production";
}

/**
 * 应用启动时的安全检查
 * 这个函数在应用启动时调用，用于验证环境配置的安全性
 */
export function performStartupSecurityChecks(): void {
  console.log("🔒 Performing startup security checks...");

  // 1. 验证环境变量
  const envValidation = validateEnvironment();
  if (!envValidation.success) {
    console.error("❌ Environment validation failed:");
    envValidation.errors.forEach((error) => console.error(`   - ${error}`));
    throw new Error(
      "Environment validation failed. Please check your configuration."
    );
  }
  console.log("✅ Environment variables validated");

  // 2. 检查敏感数据暴露
  const exposureCheck = checkSensitiveDataExposure();
  if (!exposureCheck.safe) {
    console.warn("⚠️  Sensitive data exposure warnings:");
    exposureCheck.warnings.forEach((warning) =>
      console.warn(`   - ${warning}`)
    );
  } else {
    console.log("✅ No sensitive data exposure detected");
  }

  // 3. 检查运行环境
  if (isStrictProductionRuntime()) {
    console.log("🏭 Running in production mode");

    // 生产环境额外检查
    const requiredProdVars = ["APP_URL"];

    if (isInternationalDeployment()) {
      requiredProdVars.push(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }

    const missing = requiredProdVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(
          ", "
        )}`
      );
    }

    // 检查是否配置了支付提供商
    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
    const paypalConfigured = Boolean(
      process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
    );
    const wechatConfigured = Boolean(
      process.env.WECHAT_PAY_MCH_ID &&
        (process.env.WECHAT_PAY_API_V3_KEY || process.env.WECHAT_PAY_API_KEY_V3),
    );
    const alipayConfigured = Boolean(
      process.env.ALIPAY_APP_ID || process.env.NEXT_PUBLIC_ALIPAY_APP_ID,
    );

    const paymentConfigured = isInternationalDeployment()
      ? stripeConfigured || paypalConfigured
      : wechatConfigured || alipayConfigured;

    if (!paymentConfigured) {
      console.warn("⚠️  No payment providers configured in production");
    }
  }

  // 4. 检查API密钥格式（非阻塞）
  const apiKeys = {
    stripe: process.env.STRIPE_SECRET_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };

  Object.entries(apiKeys).forEach(([provider, key]) => {
    if (key && !key.startsWith(`sk${provider === "stripe" ? "_" : "-"}`)) {
      console.warn(
        `⚠️  ${provider.toUpperCase()} API key format looks unusual`
      );
    }
  });

  console.log("🎉 Security checks completed successfully");
}

// 懒加载：延迟执行安全检查，避免在构建时阻塞
// 使用 Promise.then 确保在事件循环的下一个微任务中执行
let securityChecksPerformed = false;

if (
  typeof window === "undefined" &&
  process.env.NODE_ENV !== "test" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  // 仅在服务器端且非测试环境
  Promise.resolve().then(() => {
    if (!securityChecksPerformed) {
      securityChecksPerformed = true;
      try {
        performStartupSecurityChecks();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("🚨 Startup security check failed:", errorMessage);
        console.error("📋 Current environment:");
        console.error("   NODE_ENV:", process.env.NODE_ENV);
        console.error("   NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Set" : "✗ Missing");
        console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✓ Set" : "✗ Missing");
        console.error("   APP_URL:", process.env.APP_URL ? "✓ Set" : "✗ Missing");

        // 在生产环境中，记录警告但继续运行（避免503错误）
        // 这样用户能通过日志看到问题并修复
        if (isStrictProductionRuntime()) {
          console.warn("⚠️  Production mode: Security checks failed but continuing to serve requests");
          console.warn("⚠️  Please review the errors above and update your environment variables");
          // 不调用 process.exit(1)，让应用继续运行
        }
      }
    }
  });
}
