/**
 * Deployment configuration shared by CN and INTL builds.
 * The active region is resolved from environment variables at build/runtime.
 */

import {
  resolveDeploymentRegion,
  type DeploymentRegion,
} from "./deployment-region";
export type { DeploymentRegion } from "./deployment-region";

export interface DeploymentConfig {
  region: DeploymentRegion;
  appName: string;
  version: string;
  auth: {
    provider: "cloudbase" | "supabase";
    features: {
      emailAuth: boolean;
      phoneOtpAuth: boolean;
      googleAuth: boolean;
      githubAuth: boolean;
    };
  };
  database: {
    provider: "cloudbase" | "supabase";
  };
  payment: {
    providers: Array<"stripe" | "paypal" | "wechat" | "alipay">;
  };
  apis: {
    authCallbackPath: string;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    enableConsole: boolean;
  };
}

function generateConfig(region: DeploymentRegion): DeploymentConfig {
  const isChinaRegion = region === "CN";

  return {
    region,
    appName: "MornContract",
    version: "3.0.0",
    auth: {
      provider: isChinaRegion ? "cloudbase" : "supabase",
      features: {
        emailAuth: true,
        phoneOtpAuth: isChinaRegion,
        googleAuth: !isChinaRegion,
        githubAuth: false,
      },
    },
    database: {
      provider: isChinaRegion ? "cloudbase" : "supabase",
    },
    payment: {
      providers: isChinaRegion ? ["wechat", "alipay"] : ["stripe", "paypal"],
    },
    apis: {
      authCallbackPath: "/auth/callback",
    },
    logging: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      enableConsole: process.env.NODE_ENV !== "production",
    },
  };
}

const regionResolution = resolveDeploymentRegion(process.env);
const DEPLOYMENT_REGION: DeploymentRegion = regionResolution.region;

if (typeof window === "undefined") {
  if (regionResolution.deprecatedSourceUsed) {
    console.warn(
      `[deployment] ${regionResolution.source} is deprecated. Use NEXT_PUBLIC_DEPLOYMENT_REGION instead.`,
    );
  }

  if (regionResolution.sourceConflict) {
    console.warn(
      "[deployment] Conflicting region env vars detected; NEXT_PUBLIC_DEPLOYMENT_REGION has priority.",
    );
  }

  console.log(
    `[deployment] region=${DEPLOYMENT_REGION}, source=${regionResolution.source}, auth=${
      DEPLOYMENT_REGION === "INTL" ? "supabase" : "cloudbase"
    }`,
  );
}

export const deploymentConfig: DeploymentConfig =
  generateConfig(DEPLOYMENT_REGION);

export const currentRegion: DeploymentRegion = DEPLOYMENT_REGION;

export function getDefaultLanguage(): "zh" | "en" {
  return DEPLOYMENT_REGION === "CN" ? "zh" : "en";
}

export function getAppDisplayName(): string {
  return "MornContract";
}

export function isLanguageSwitchingEnabled(): boolean {
  return false;
}

export function isChinaDeployment(): boolean {
  return deploymentConfig.region === "CN";
}

export function isInternationalDeployment(): boolean {
  return deploymentConfig.region === "INTL";
}

export function getAuthProvider(): "cloudbase" | "supabase" {
  return deploymentConfig.auth.provider;
}

export function getDatabaseProvider(): "cloudbase" | "supabase" {
  return deploymentConfig.database.provider;
}

export function isAuthFeatureSupported(
  feature: keyof typeof deploymentConfig.auth.features,
): boolean {
  return deploymentConfig.auth.features[feature];
}

export function getPaymentProviders(): DeploymentConfig["payment"]["providers"] {
  return deploymentConfig.payment.providers;
}

export function isPaymentMethodSupported(
  method: DeploymentConfig["payment"]["providers"][number],
): boolean {
  return deploymentConfig.payment.providers.includes(method);
}

export function getFullConfig(): DeploymentConfig {
  return deploymentConfig;
}
