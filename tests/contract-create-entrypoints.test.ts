import {
  CONTRACT_CREATE_METHODS,
  buildContractCreateRoute,
  isContractCreateImportMethod,
  isOcrImportMethod,
  resolveContractCreateImportMethod,
} from "@/lib/contracts/create-entrypoints";

function readSearchParams(path: string) {
  const url = new URL(path, "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

describe("contract create entrypoints", () => {
  test("keeps the four canonical create methods", () => {
    expect(CONTRACT_CREATE_METHODS).toEqual([
      "text",
      "screenshot",
      "wechat",
      "ai-chat",
    ]);
  });

  test("builds canonical routes for all four methods", () => {
    expect(buildContractCreateRoute("text")).toBe("/create/import?method=text");
    expect(buildContractCreateRoute("screenshot")).toBe(
      "/create/import?method=screenshot",
    );
    expect(buildContractCreateRoute("wechat")).toBe("/create/import?method=wechat");
    expect(buildContractCreateRoute("ai-chat")).toBe("/create/ai-chat");
  });

  test("builds dashboard routes with template id", () => {
    const importPath = buildContractCreateRoute("wechat", {
      flowContext: "dashboard",
      templateId: "tpl_123",
    });
    const aiChatPath = buildContractCreateRoute("ai-chat", {
      flowContext: "dashboard",
      templateId: "tpl_123",
    });

    expect(importPath.startsWith("/create/import?")).toBe(true);
    expect(readSearchParams(importPath)).toEqual({
      ctx: "dashboard",
      templateId: "tpl_123",
      method: "wechat",
    });

    expect(aiChatPath.startsWith("/create/ai-chat?")).toBe(true);
    expect(readSearchParams(aiChatPath)).toEqual({
      ctx: "dashboard",
      templateId: "tpl_123",
    });
  });

  test("resolves and validates import methods safely", () => {
    expect(isContractCreateImportMethod("text")).toBe(true);
    expect(isContractCreateImportMethod("screenshot")).toBe(true);
    expect(isContractCreateImportMethod("wechat")).toBe(true);
    expect(isContractCreateImportMethod("ai-chat")).toBe(false);
    expect(isContractCreateImportMethod("unknown")).toBe(false);

    expect(resolveContractCreateImportMethod(undefined)).toEqual({
      method: "text",
      isKnown: true,
    });
    expect(resolveContractCreateImportMethod("wechat")).toEqual({
      method: "wechat",
      isKnown: true,
    });
    expect(resolveContractCreateImportMethod("ai-chat")).toEqual({
      method: "text",
      isKnown: false,
    });
  });

  test("marks OCR-capable import methods", () => {
    expect(isOcrImportMethod("text")).toBe(false);
    expect(isOcrImportMethod("screenshot")).toBe(true);
    expect(isOcrImportMethod("wechat")).toBe(true);
  });
});
