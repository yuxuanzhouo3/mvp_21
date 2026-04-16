import { describe, expect, test } from "@jest/globals";
import { resolveDeploymentRegion } from "@/lib/config/deployment-region";

describe("deployment region resolution", () => {
  test("prioritizes NEXT_PUBLIC_DEPLOYMENT_REGION", () => {
    const resolved = resolveDeploymentRegion({
      NEXT_PUBLIC_DEPLOYMENT_REGION: "INTL",
      NEXT_PUBLIC_APP_REGION: "CN",
      APP_REGION: "CN",
    });

    expect(resolved.region).toBe("INTL");
    expect(resolved.source).toBe("NEXT_PUBLIC_DEPLOYMENT_REGION");
    expect(resolved.sourceConflict).toBe(true);
    expect(resolved.deprecatedSourceUsed).toBe(false);
  });

  test("falls back to legacy APP region with deprecation marker", () => {
    const resolved = resolveDeploymentRegion({
      APP_REGION: "INTL",
    });

    expect(resolved.region).toBe("INTL");
    expect(resolved.source).toBe("APP_REGION");
    expect(resolved.deprecatedSourceUsed).toBe(true);
  });

  test("defaults to CN when no region env is configured", () => {
    const resolved = resolveDeploymentRegion({});
    expect(resolved.region).toBe("CN");
    expect(resolved.source).toBe("default");
  });
});
