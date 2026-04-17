import { describe, expect, test } from "@jest/globals";

import type { PlatformType } from "@/lib/config/download.config";
import {
  inferPreferredVariant,
  pickRecommendedVariantItem,
} from "@/lib/downloads/recommendation";

type Item = {
  platform: PlatformType;
  variant?: string;
  href: string;
};

describe("download recommendation", () => {
  test("infers preferred variant from user agent", () => {
    expect(
      inferPreferredVariant(
        "windows",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ),
    ).toBe("x64");
    expect(
      inferPreferredVariant(
        "windows",
        "Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36",
      ),
    ).toBe("arm64");
    expect(
      inferPreferredVariant(
        "macos",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6)",
      ),
    ).toBe("intel");
    expect(
      inferPreferredVariant(
        "macos",
        "Mozilla/5.0 (Macintosh; Apple Silicon Mac OS X 14_0)",
      ),
    ).toBe("m");
  });

  test("picks one deterministic recommendation for multi-variant channels", () => {
    const items: Item[] = [
      { platform: "windows", variant: "x86", href: "/x86" },
      { platform: "windows", variant: "x64", href: "/x64" },
      { platform: "windows", variant: "arm64", href: "/arm64" },
    ];

    expect(
      pickRecommendedVariantItem(items, "windows", "x64")?.href,
    ).toBe("/x64");
    expect(
      pickRecommendedVariantItem(items, "windows", "arm64")?.href,
    ).toBe("/arm64");
    expect(
      pickRecommendedVariantItem(items, "windows", undefined)?.href,
    ).toBe("/x64");
  });
});
