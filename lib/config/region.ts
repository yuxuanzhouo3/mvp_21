/**
 * Region helpers built on top of deployment.config.ts.
 * This file is used widely across the app, so keep the public API stable.
 */

import { currentRegion, deploymentConfig } from "./deployment.config";
import { getOpenAIModel, getQwenModel } from "./runtime-env";

export type Region = "CN" | "INTL";

let cachedRegion: Region | null = null;

const DEFAULT_CN_HOSTS = ["morncontract.mornscience.top"];
const DEFAULT_INTL_HOSTS = ["www.mornhub.quest"];

function normalizeHostCandidate(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

function parseHosts(envValue: string | undefined, fallback: string[]): string[] {
  const fromEnv = (envValue || "")
    .split(",")
    .map((item) => normalizeHostCandidate(item))
    .filter((item): item is string => Boolean(item));

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return fallback
    .map((item) => normalizeHostCandidate(item))
    .filter((item): item is string => Boolean(item));
}

function hostMatches(hostname: string, candidates: string[]): boolean {
  return candidates.some(
    (candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`),
  );
}

function resolveRegionFromHostname(hostname: string): Region | null {
  const normalizedHost = hostname.trim().toLowerCase();
  if (!normalizedHost) {
    return null;
  }

  const cnHosts = parseHosts(
    process.env.NEXT_PUBLIC_DOMESTIC_HOSTS,
    DEFAULT_CN_HOSTS,
  );
  const intlHosts = parseHosts(
    process.env.NEXT_PUBLIC_INTL_HOSTS,
    DEFAULT_INTL_HOSTS,
  );

  if (hostMatches(normalizedHost, cnHosts)) {
    return "CN";
  }

  if (hostMatches(normalizedHost, intlHosts)) {
    return "INTL";
  }

  if (normalizedHost.endsWith(".cn")) {
    return "CN";
  }

  if (normalizedHost.includes("mornscience.top")) {
    return "CN";
  }

  if (normalizedHost.includes("mornhub.quest")) {
    return "INTL";
  }

  return null;
}

function getDeployRegion(): Region {
  if (typeof window !== "undefined") {
    const runtimeRegion = resolveRegionFromHostname(
      window.location.hostname || "",
    );
    if (runtimeRegion) {
      cachedRegion = runtimeRegion;
      return runtimeRegion;
    }
  }

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
  : ["stripe", "paypal"];
const paymentCurrency = isChinaRegion() ? "CNY" : "USD";

function resolveAvailableAiModels(provider: "dashscope" | "openai"): string[] {
  if (provider === "dashscope") {
    if (typeof window !== "undefined") {
      return ["qwen-plus", "qwen-max", "qwen-vl-plus"];
    }

    try {
      return [getQwenModel(), "qwen-max", "qwen-vl-plus"];
    } catch (error) {
      console.warn("[RegionConfig] Failed to resolve Qwen model, using fallback:", error);
      return ["qwen-plus", "qwen-max", "qwen-vl-plus"];
    }
  }

  if (typeof window !== "undefined") {
    // Browser bundle must not depend on server-only OPENAI_* env variables.
    return ["gpt-4.1"];
  }

  try {
    return [getOpenAIModel()];
  } catch (error) {
    console.warn("[RegionConfig] Failed to resolve OpenAI model, using fallback:", error);
    return ["gpt-4.1"];
  }
}

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
    availableModels: resolveAvailableAiModels(aiProvider),
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
