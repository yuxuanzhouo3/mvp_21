import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("payment page route alignment", () => {
  test("payment form creates orders through the unified payment create route", () => {
    const source = readWorkspaceFile("components/payment/payment-form.tsx");

    expect(source).toContain('fetch("/api/payment/create"');
    expect(source).not.toContain('fetch("/api/payment/onetime/create"');
  });

  test("payment success confirmation uses the unified confirm route", () => {
    const source = readWorkspaceFile("app/payment/success/page.tsx");

    expect(source).toContain('fetch("/api/payment/confirm"');
    expect(source).not.toContain("/api/payment/onetime/confirm");
  });

  test("wechat qr confirmation also uses the unified confirm route", () => {
    const source = readWorkspaceFile("app/payment/wechat-qrcode/page.tsx");

    expect(source).toContain('fetch("/api/payment/confirm"');
    expect(source).not.toContain("/api/payment/onetime/confirm");
  });
});
