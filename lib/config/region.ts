/**
 * Region helpers built on top of deployment.config.ts.
 * This file is used widely across the app, so keep the public API stable.
 */

import { currentRegion, deploymentConfig } from "./deployment.config";
import { getOpenAIModel, getQwenModel } from "./runtime-env";

export type Region = "CN" | "INTL";

let cachedRegion: Region | null = null;

function getDeployRegion(): Region {
  if (!cachedRegion) {
    cachedRegion = currentRegion;
  }

  return cachedRegion;
}

export function getDEPLOY_REGION(): Region {
  return getDeployRegion();
}

export const DEPLOY_REGION: Region = getDeployRegion();

export const isChinaRegion = (): boolean => getDeployRegion() === "CN";

export const isInternationalRegion = (): boolean =>
  getDeployRegion() === "INTL";

const paymentProviders = deploymentConfig.payment.providers;
const primaryPaymentMethod =
  paymentProviders[0] || (isChinaRegion() ? "wechat" : "stripe");
const aiProvider = isChinaRegion() ? "dashscope" : "openai";
const paymentMethods = isChinaRegion()
  ? ["wechat", "alipay"]
  : ["stripe"];
const paymentCurrency = isChinaRegion() ? "CNY" : "USD";

export const RegionConfig = {
  auth: {
    provider: deploymentConfig.auth.provider,
    features: {
      ...deploymentConfig.auth.features,
    },
  },
  database: {
    provider: deploymentConfig.database.provider,
  },
  payment: {
    methods: paymentMethods,
    currency: paymentCurrency,
    providers: paymentProviders,
    primary: primaryPaymentMethod,
  },
  ai: {
    provider: aiProvider,
    availableModels:
      aiProvider === "dashscope"
        ? [getQwenModel(), "qwen-max", "qwen-vl-plus"]
        : [getOpenAIModel()],
  },
  storage: {
    provider: deploymentConfig.database.provider,
  },
  redirectUrls: {
    domestic: process.env.DOMESTIC_SYSTEM_URL,
    international: process.env.INTERNATIONAL_SYSTEM_URL,
  },
  ipDetection: {
    enabled: true,
    apiUrl: process.env.IP_API_URL || "https://ipapi.co/json/",
    cacheTtl: parseInt(process.env.GEO_CACHE_TTL || "3600000", 10),
  },
  region: isChinaRegion() ? "CN" : "INTL",
  isDomestic: isChinaRegion(),
} as const;

export function validateRegionConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!["CN", "INTL"].includes(getDeployRegion())) {
    errors.push(`Invalid deployment region: ${getDeployRegion()}`);
  }

  if (isChinaRegion()) {
    if (!process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID) {
      errors.push("CN deployment requires NEXT_PUBLIC_WECHAT_CLOUDBASE_ID");
    }
    if (!process.env.DASHSCOPE_API_KEY) {
      errors.push("CN deployment requires DASHSCOPE_API_KEY");
    }
  }

  if (isInternationalRegion()) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push("INTL deployment requires NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!process.env.OPENAI_API_KEY) {
      errors.push("INTL deployment requires OPENAI_API_KEY");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function printRegionConfig() {
  const validation = validateRegionConfig();
  const region = getDeployRegion();

  console.log("\n========== Region Configuration ==========");
  console.log(`region: ${region}`);
  console.log(`auth: ${RegionConfig.auth.provider}`);
  console.log(`database: ${RegionConfig.database.provider}`);
  console.log(`payment: ${RegionConfig.payment.primary}`);
  console.log(`ai: ${RegionConfig.ai.provider}`);

  if (!validation.valid) {
    console.log("validation errors:");
    validation.errors.forEach((error) => console.log(`- ${error}`));
  }

  console.log("==========================================\n");
}
