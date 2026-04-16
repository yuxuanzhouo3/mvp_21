import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("onetime payment false-success guardrails", () => {
  test("create route fails closed when payment record persistence fails", () => {
    const source = readWorkspaceFile("app/api/payment/onetime/create/route.ts");

    expect(source).toContain("PAYMENT_RECORD_PERSIST_FAILED");
    expect(source).toContain('return NextResponse.json(');
    expect(source).not.toContain("continuing anyway");
  });

  test("confirm route fails closed on payment record write/update failures", () => {
    const source = readWorkspaceFile("app/api/payment/onetime/confirm/route.ts");

    expect(source).toContain("PAYMENT_RECORD_PERSIST_FAILED");
    expect(source).toContain("PAYMENT_RECORD_UPDATE_FAILED");
    expect(source).toContain("INVALID_PAYMENT_AMOUNT");
  });

  test("confirm route reports webhook-deferred membership state explicitly", () => {
    const source = readWorkspaceFile("app/api/payment/onetime/confirm/route.ts");

    expect(source).toContain('membershipStatus: "pending_webhook"');
    expect(source).toContain("{ status: 202 }");
  });
});
