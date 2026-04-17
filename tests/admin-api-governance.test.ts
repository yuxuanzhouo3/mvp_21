import { describe, expect, test } from "@jest/globals";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walkRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      files.push(...walkRouteFiles(full));
      continue;
    }

    if (entry === "route.ts") {
      files.push(full);
    }
  }

  return files;
}

describe("admin api governance", () => {
  test("all admin route handlers enforce requireAdmin(request)", () => {
    const adminApiRoot = join(process.cwd(), "app", "api", "admin");
    const routeFiles = walkRouteFiles(adminApiRoot);
    const exemptRoutes = new Set([join(adminApiRoot, "check-auth", "route.ts")]);
    const governedRouteFiles = routeFiles.filter((routeFile) => !exemptRoutes.has(routeFile));

    expect(governedRouteFiles.length).toBeGreaterThan(0);

    for (const routeFile of governedRouteFiles) {
      const source = readFileSync(routeFile, "utf8");
      expect(source).toMatch(/requireAdmin\s*\(\s*request\s*\)/);
    }
  });

  test("dashboard template creation route enforces membership create permission", () => {
    const source = readFileSync(
      join(process.cwd(), "app", "api", "dashboard", "templates", "route.ts"),
      "utf8",
    );

    expect(source).toContain("permissions.canCreate");
    expect(source).toContain("Your current plan cannot create templates.");
  });
});
