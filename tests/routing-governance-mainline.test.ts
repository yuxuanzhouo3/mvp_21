import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getLegacyContractEntrypointHref } from "@/lib/contracts/legacy-entrypoints";

describe("routing governance mainline coverage", () => {
  test("legacy contract entrypoints resolve to the canonical create flow", () => {
    expect(getLegacyContractEntrypointHref("create")).toBe("/create");
    expect(getLegacyContractEntrypointHref("new")).toBe("/create");
    expect(getLegacyContractEntrypointHref("uploadTemplate")).toBe(
      "/create/import?method=screenshot&legacy=upload-template",
    );
  });

  test("next config keeps permanent redirects for the removed legacy pages", () => {
    const nextConfigSource = readFileSync(
      join(process.cwd(), "next.config.mjs"),
      "utf8",
    );

    expect(nextConfigSource).toContain('source: "/contracts/create"');
    expect(nextConfigSource).toContain('destination: "/create"');
    expect(nextConfigSource).toContain('source: "/contracts/new"');
    expect(nextConfigSource).toContain('source: "/contracts/upload-template"');
    expect(nextConfigSource).toContain(
      'destination: "/create/import?method=screenshot&legacy=upload-template"',
    );
  });
});
