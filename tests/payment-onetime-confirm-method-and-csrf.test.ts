import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("onetime confirm method and origin policy", () => {
  test("state-changing onetime confirm route exposes POST only", () => {
    const source = readWorkspaceFile("app/api/payment/onetime/confirm/route.ts");

    expect(source).toContain("export async function POST");
    expect(source).not.toContain("export async function GET");
  });

  test("onetime confirm route enforces origin validation for cookie flows", () => {
    const source = readWorkspaceFile("app/api/payment/onetime/confirm/route.ts");

    expect(source).toContain("validateStateChangingRequestOrigin");
    expect(source).toContain("ORIGIN_VALIDATION_FAILED");
    expect(source).toContain('request.headers.get("origin")');
    expect(source).toContain('request.headers.get("referer")');
  });
});
