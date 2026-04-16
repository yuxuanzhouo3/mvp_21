export type DeploymentRegion = "CN" | "INTL";

type RegionSource =
  | "NEXT_PUBLIC_DEPLOYMENT_REGION"
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

export function resolveDeploymentRegion(
  env: Record<string, string | undefined> = process.env,
): DeploymentRegionResolution {
  const fromDeployment = normalizeRegion(env.NEXT_PUBLIC_DEPLOYMENT_REGION);
  const fromLegacyPublic = normalizeRegion(env.NEXT_PUBLIC_APP_REGION);
  const fromLegacyServer = normalizeRegion(env.APP_REGION);

  if (fromDeployment) {
    const sourceConflict =
      Boolean(fromLegacyPublic && fromLegacyPublic !== fromDeployment) ||
      Boolean(fromLegacyServer && fromLegacyServer !== fromDeployment);

    return {
      region: fromDeployment,
      source: "NEXT_PUBLIC_DEPLOYMENT_REGION",
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
