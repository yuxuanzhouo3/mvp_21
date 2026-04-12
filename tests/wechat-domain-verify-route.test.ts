import { describe, expect, jest, test } from "@jest/globals";
import { NextRequest } from "next/server";

const WECHAT_VERIFY_PATH = "/I1yRwv6X3I.txt";
const WECHAT_VERIFY_CONTENT = "4e8934892f52479d1dd06c4ece98bf58";

describe("wechat domain verify route", () => {
  test("returns exact plain text without invoking auth-adjacent middleware stages", async () => {
    jest.resetModules();

    const detectMock = jest.fn(async () => ({
      region: "CN",
      countryCode: "CN",
      currency: "CNY",
    }));
    const csrfMock = jest.fn(async () => new Response(null, { status: 200 }));

    jest.doMock("@/lib/architecture-modules/core/geo-router", () => ({
      geoRouter: { detect: detectMock },
    }));
    jest.doMock("@/lib/security/csrf", () => ({
      csrfProtection: csrfMock,
    }));

    const { middleware } = await import("@/middleware");
    const request = new NextRequest(`https://example.com${WECHAT_VERIFY_PATH}`, {
      method: "GET",
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe(WECHAT_VERIFY_CONTENT);
    expect(detectMock).not.toHaveBeenCalled();
    expect(csrfMock).not.toHaveBeenCalled();
  });
});
