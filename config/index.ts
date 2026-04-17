import {
  resolveDeploymentRegion,
  type DeploymentRegion,
} from "@/lib/config/deployment-region";

/**
 * @deprecated Use "@/lib/config/deployment-region" or "@/lib/config/deployment.config".
 * This module remains as a compatibility shim and must not contain independent
 * region resolution logic.
 */
export function getDeploymentRegion(): DeploymentRegion {
  return resolveDeploymentRegion();
}

export function isDomesticDeployment(): boolean {
  return getDeploymentRegion() === "CN";
}

const DEPLOYMENT_REGION = getDeploymentRegion();

export const IS_CN_DEPLOYMENT = DEPLOYMENT_REGION === "CN";
export const IS_INTL_DEPLOYMENT = DEPLOYMENT_REGION === "INTL";

// backward compatibility
export const IS_DOMESTIC_VERSION = IS_CN_DEPLOYMENT;
export const DEFAULT_REGION: "cn" | "global" = IS_CN_DEPLOYMENT ? "cn" : "global";
export const DEFAULT_LANGUAGE = IS_CN_DEPLOYMENT ? "zh" : "en";

export const APP_CONFIG = {
  name: "MornContract",
  description: IS_CN_DEPLOYMENT ? "企业合同平台" : "Enterprise contract platform",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
};

export const DATABASE_CONFIG = {
  domestic: {
    provider: "cloudbase",
    region: "cn" as const,
    enabled: IS_CN_DEPLOYMENT,
  },
  international: {
    provider: "supabase",
    region: "global" as const,
    enabled: IS_INTL_DEPLOYMENT,
  },
};

export const getCurrentDatabaseConfig = () => {
  return IS_CN_DEPLOYMENT ? DATABASE_CONFIG.domestic : DATABASE_CONFIG.international;
};
