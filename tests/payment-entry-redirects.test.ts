import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("payment entry redirect governance", () => {
  test("signup route preserves plan-upgrade intent and redirects through auth", () => {
    const source = readWorkspaceFile("app/signup/page.tsx");

    expect(source).toContain('requestedPlan === "pro"');
    expect(source).toContain("nextRedirect = `/payment?plan=pro&cycle=${cycle}&tab=payment`");
    expect(source).toContain('authParams.set("mode", "signup")');
    expect(source).toContain('authParams.set("redirect", nextRedirect)');
  });

  test("payment page keeps post-login return target for unauthenticated visitors", () => {
    const source = readWorkspaceFile("app/payment/page.tsx");

    expect(source).toContain('authParams.set("mode", "signin")');
    expect(source).toContain('authParams.set("redirect", `/payment${window.location.search || ""}`)');
  });

  test("dashboard entries route compare/plan shortcuts to the payment center", () => {
    const billingPage = readWorkspaceFile("app/dashboard/billing/page.tsx");
    const appSidebar = readWorkspaceFile("components/dashboard/app-sidebar.tsx");

    expect(billingPage).toContain('href="/payment?tab=plans"');
    expect(appSidebar).toContain('href="/payment?tab=plans"');
  });

  test("public pricing upgrade CTA opens payment center directly", () => {
    const pricing = readWorkspaceFile("components/pricing.tsx");

    expect(pricing).toContain('href: "/payment?plan=pro&cycle=monthly&tab=payment"');
    expect(pricing).not.toContain("/signup?plan=pro");
  });
});
