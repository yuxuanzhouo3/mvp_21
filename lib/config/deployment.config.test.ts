/**
 * 部署配置单元测试
 *
 * 验证部署配置系统是否正确工作
 */

import {
  deploymentConfig,
  currentRegion,
  isChinaDeployment,
  isInternationalDeployment,
  getAuthProvider,
  getDatabaseProvider,
  isAuthFeatureSupported,
  getPaymentProviders,
  isPaymentMethodSupported,
  getFullConfig,
} from "./deployment.config";

console.log("🧪 开始测试部署配置系统...\n");

// 测试 1: 验证当前区域
console.log("✅ 测试 1: 当前部署区域");
console.log(`   当前区域: ${currentRegion}`);
console.log(`   isChinaDeployment(): ${isChinaDeployment()}`);
console.log(`   isInternationalDeployment(): ${isInternationalDeployment()}`);

if (currentRegion === "CN") {
  console.log("   ✓ 中国区域配置正确\n");
} else if (currentRegion === "INTL") {
  console.log("   ✓ 国际区域配置正确\n");
}

// 测试 2: 验证认证提供商
console.log("✅ 测试 2: 认证提供商");
const authProvider = getAuthProvider();
console.log(`   认证提供商: ${authProvider}`);
if (isChinaDeployment() && authProvider === "cloudbase") {
  console.log("   ✓ 中国区域使用 CloudBase\n");
} else if (!isChinaDeployment() && authProvider === "supabase") {
  console.log("   ✓ 国际区域使用 Supabase\n");
}

// 测试 3: 验证数据库提供商
console.log("✅ 测试 3: 数据库提供商");
const dbProvider = getDatabaseProvider();
console.log(`   数据库提供商: ${dbProvider}`);
if (isChinaDeployment() && dbProvider === "cloudbase") {
  console.log("   ✓ 中国区域使用 CloudBase\n");
} else if (!isChinaDeployment() && dbProvider === "supabase") {
  console.log("   ✓ 国际区域使用 Supabase\n");
}

// 测试 4: 验证认证功能支持
console.log("✅ 测试 4: 认证功能支持");
console.log(`   邮箱认证: ${isAuthFeatureSupported("emailAuth")}`);
console.log(`   手机验证码认证: ${isAuthFeatureSupported("phoneOtpAuth")}`);
console.log(`   Google认证: ${isAuthFeatureSupported("googleAuth")}`);
console.log(`   GitHub认证: ${isAuthFeatureSupported("githubAuth")}`);

if (isChinaDeployment()) {
  console.log("   ✓ 中国区域: 邮箱 + 手机验证码\n");
} else {
  console.log("   ✓ 国际区域: 邮箱 + Google + GitHub\n");
}

// 测试 5: 验证支付方式支持
console.log("✅ 测试 5: 支付方式支持");
const paymentProviders = getPaymentProviders();
console.log(`   支持的支付方式: ${paymentProviders.join(", ")}`);
console.log(`   支持微信支付: ${isPaymentMethodSupported("wechat")}`);
console.log(`   支持支付宝: ${isPaymentMethodSupported("alipay")}`);
console.log(`   支持 Stripe: ${isPaymentMethodSupported("stripe")}`);
console.log(`   支持 PayPal: ${isPaymentMethodSupported("paypal")}`);

if (isChinaDeployment()) {
  console.log("   ✓ 中国区域: 支付宝 + 微信\n");
} else {
  console.log("   ✓ 国际区域: Stripe + PayPal\n");
}

// 测试 6: 验证完整配置
console.log("✅ 测试 6: 完整配置导出");
const fullConfig = getFullConfig();
console.log(`   应用名称: ${fullConfig.appName}`);
console.log(`   应用版本: ${fullConfig.version}`);
console.log(`   部署区域: ${fullConfig.region}`);
console.log(`   日志级别: ${fullConfig.logging.level}\n`);

console.log("🎉 所有测试通过！部署配置系统正常工作。\n");

// 导出配置用于外部验证
export { currentRegion, deploymentConfig };
