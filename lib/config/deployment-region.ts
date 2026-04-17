export type DeploymentRegion = "CN" | "INTL";

type RegionSource =
  | "NEXT_PUBLIC_DEPLOYMENT_REGION"
  | "DEPLOYMENT_REGION"
  | "NEXT_PUBLIC_APP_REGION"
  | "APP_REGION"
  | "default";

export interface DeploymentRegionResolution {
  region: DeploymentRegion;
  source: RegionSource;
  deprecatedSourceUsed: boolean;
  sourceConflict: boolean;
}

function normalizeRegion(value: string | undefined): DeploymentRegion | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "CN" || normalized === "INTL") {
    return normalized;
  }

  return null;
}

function resolveDeploymentRegionResolution(
  env: Record<string, string | undefined>,
): DeploymentRegionResolution {
  const fromDeployment = normalizeRegion(env.NEXT_PUBLIC_DEPLOYMENT_REGION);
  const fromServerDeployment = normalizeRegion(env.DEPLOYMENT_REGION);
  const fromLegacyPublic = normalizeRegion(env.NEXT_PUBLIC_APP_REGION);
  const fromLegacyServer = normalizeRegion(env.APP_REGION);

  if (fromDeployment) {
    const sourceConflict =
      Boolean(fromServerDeployment && fromServerDeployment !== fromDeployment) ||
      Boolean(fromLegacyPublic && fromLegacyPublic !== fromDeployment) ||
      Boolean(fromLegacyServer && fromLegacyServer !== fromDeployment);

    return {
      region: fromDeployment,
      source: "NEXT_PUBLIC_DEPLOYMENT_REGION",
      deprecatedSourceUsed: false,
      sourceConflict,
    };
  }

  if (fromServerDeployment) {
    const sourceConflict =
      Boolean(fromLegacyPublic && fromLegacyPublic !== fromServerDeployment) ||
      Boolean(fromLegacyServer && fromLegacyServer !== fromServerDeployment);

    return {
      region: fromServerDeployment,
      source: "DEPLOYMENT_REGION",
      deprecatedSourceUsed: false,
      sourceConflict,
    };
  }

  if (fromLegacyPublic) {
    return {
      region: fromLegacyPublic,
      source: "NEXT_PUBLIC_APP_REGION",
      deprecatedSourceUsed: true,
      sourceConflict: false,
    };
  }

  if (fromLegacyServer) {
    return {
      region: fromLegacyServer,
      source: "APP_REGION",
      deprecatedSourceUsed: true,
      sourceConflict: false,
    };
  }

  return {
    region: "CN",
    source: "default",
    deprecatedSourceUsed: false,
    sourceConflict: false,
  };
}

export function resolveDeploymentRegion(): DeploymentRegion;
export function resolveDeploymentRegion(
  env: Record<string, string | undefined>,
): DeploymentRegionResolution;
export function resolveDeploymentRegion(
  env?: Record<string, string | undefined>,
): DeploymentRegion | DeploymentRegionResolution {
  const resolution = resolveDeploymentRegionResolution(env ?? process.env);
  return env ? resolution : resolution.region;
}
