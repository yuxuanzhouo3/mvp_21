import { afterEach, describe, expect, test } from "@jest/globals";

import { verifyMarketAdminLogin } from "@/lib/market/admin-auth";

const originalMarketUsername = process.env.MARKET_ADMIN_USERNAME;
const originalMarketPassword = process.env.MARKET_ADMIN_PASSWORD;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalAdminPassword = process.env.ADMIN_PASSWORD;

afterEach(() => {
  process.env.MARKET_ADMIN_USERNAME = originalMarketUsername;
  process.env.MARKET_ADMIN_PASSWORD = originalMarketPassword;
  process.env.ADMIN_USERNAME = originalAdminUsername;
  process.env.ADMIN_PASSWORD = originalAdminPassword;
});

describe("market admin auth credential verification", () => {
  test("accepts built-in fixed admin credential in both regions", () => {
    delete process.env.MARKET_ADMIN_USERNAME;
    delete process.env.MARKET_ADMIN_PASSWORD;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;

    expect(
      verifyMarketAdminLogin({
        username: "admin",
        password: "zyx!213416",
      }),
    ).toBe(true);
  });

  test("rejects incorrect password for built-in admin account", () => {
    expect(
      verifyMarketAdminLogin({
        username: "admin",
        password: "wrong-pass",
      }),
    ).toBe(false);
  });

  test("still accepts configured env credentials for backward compatibility", () => {
    process.env.MARKET_ADMIN_USERNAME = "ops";
    process.env.MARKET_ADMIN_PASSWORD = "ops-pass";

    expect(
      verifyMarketAdminLogin({
        username: "ops",
        password: "ops-pass",
      }),
    ).toBe(true);
  });
});

