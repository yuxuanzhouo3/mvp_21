import { describe, expect, jest, test } from "@jest/globals";

describe("region runtime host override", () => {
  test("resolves INTL on mornhub host in browser runtime", async () => {
    jest.resetModules();
    (globalThis as any).window = {
      location: {
        hostname: "www.mornhub.quest",
      },
    };

    const { isChinaRegion, isInternationalRegion } = await import(
      "@/lib/config/region"
    );

    expect(isChinaRegion()).toBe(false);
    expect(isInternationalRegion()).toBe(true);
    delete (globalThis as any).window;
  });

  test("resolves CN on mornscience host in browser runtime", async () => {
    jest.resetModules();
    (globalThis as any).window = {
      location: {
        hostname: "morncontract.mornscience.top",
      },
    };

    const { isChinaRegion, isInternationalRegion } = await import(
      "@/lib/config/region"
    );

    expect(isChinaRegion()).toBe(true);
    expect(isInternationalRegion()).toBe(false);
    delete (globalThis as any).window;
  });
});
