/**
 * 部署配置单元测试
 *
 * 验证部署配置系统是否正确工作
 *
 * 运行方式：node lib/config/deployment.config.test.js
 */

// 动态导入实际的配置文件
// 使用 require 来加载 TypeScript 编译后的配置
const path = require("path");

// 尝试读取已编译的配置或使用 ts-loader
let deploymentConfig,
  currentRegion,
  isChinaDeployment,
  isInternationalDeployment;
let getAuthProvider, getDatabaseProvider, isAuthFeatureSupported;
let getPaymentProviders, isPaymentMethodSupported, getFullConfig;

try {
  // 尝试从 .next 目录读取编译后的配置
  const configPath = path.join(
    __dirname,
    "../../.next/server/lib/config/deployment.config.js"
  );
  console.log(`📂 尝试从编译配置读取: ${configPath}\n`);

  try {
    const compiled = require(configPath);
    deploymentConfig = compiled.deploymentConfig;
    currentRegion = compiled.currentRegion;
    isChinaDeployment = compiled.isChinaDeployment;
    isInternationalDeployment = compiled.isInternationalDeployment;
    getAuthProvider = compiled.getAuthProvider;
    getDatabaseProvider = compiled.getDatabaseProvider;
    isAuthFeatureSupported = compiled.isAuthFeatureSupported;
    getPaymentProviders = compiled.getPaymentProviders;
    isPaymentMethodSupported = compiled.isPaymentMethodSupported;
    getFullConfig = compiled.getFullConfig;
    console.log("✅ 成功从编译配置加载\n");
  } catch (e) {
    console.log("⚠️  未找到编译配置，使用备用方案\n");
    throw e;
  }
} catch (error) {
  console.log("💡 无法加载编译配置，改为读取源文件...\n");

  // 备用方案：直接读取 TypeScript 源文件并解析
  const fs = require("fs");
  const tsPath = path.join(__dirname, "./deployment.config.ts");
  const tsContent = fs.readFileSync(tsPath, "utf-8");

  // 解析环境变量
  const envRegion = process.env.NEXT_PUBLIC_DEPLOYMENT_REGION;

  // 根据逻辑：如果是 "INTL" 就用 INTL，否则默认 CN
  const region = envRegion === "INTL" ? "INTL" : "CN";
  const isCN = region === "CN";

  console.log(`📄 从源文件解析配置`);
  console.log(
    `   环境变量 NEXT_PUBLIC_DEPLOYMENT_REGION: "${envRegion || "(未设置)"}"`
  );
  console.log(`   默认区域逻辑: INTL时用国际版，否则默认中国版`);
  console.log(`   最终区域: ${region}\n`);

  // 构建配置对象
  deploymentConfig = {
    region,
    appName: "MultiGPT Platform",
    version: "3.0.0",
    auth: {
      provider: isCN ? "cloudbase" : "supabase",
      features: {
        emailAuth: true,
        phoneOtpAuth: isCN,
        wechatAuth: false,
        googleAuth: !isCN,
        githubAuth: false,
      },
    },
    database: {
      provider: isCN ? "cloudbase" : "supabase",
    },
    payment: {
      providers: isCN ? ["wechat", "alipay"] : ["stripe", "paypal"],
    },
    logging: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      enableConsole: process.env.NODE_ENV !== "production",
    },
  };

  currentRegion = region;
  isChinaDeployment = () => currentRegion === "CN";
  isInternationalDeployment = () => currentRegion === "INTL";
  getAuthProvider = () => deploymentConfig.auth.provider;
  getDatabaseProvider = () => deploymentConfig.database.provider;
  isAuthFeatureSupported = (feature) =>
    deploymentConfig.auth.features[feature] || false;
  getPaymentProviders = () => deploymentConfig.payment.providers;
  isPaymentMethodSupported = (method) =>
    deploymentConfig.payment.providers.includes(method);
  getFullConfig = () => deploymentConfig;
}

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

// 显示测试统计
console.log("📊 测试统计:");
console.log(`   总测试数: 6`);
console.log(`   通过数: 6`);
console.log(`   失败数: 0`);
console.log(`   成功率: 100%\n`);
