export type ContractCreateMethod = "text" | "screenshot" | "wechat" | "ai-chat";
export type ContractCreateImportMethod = Exclude<ContractCreateMethod, "ai-chat">;
export type CreateFlowContext = "standalone" | "dashboard";

export interface ResolveImportMethodResult {
  method: ContractCreateImportMethod;
  isKnown: boolean;
}

export interface BuildCreateRouteOptions {
  flowContext?: CreateFlowContext;
  templateId?: string | null | undefined;
}

export const CONTRACT_CREATE_METHODS: readonly ContractCreateMethod[] = [
  "text",
  "screenshot",
  "wechat",
  "ai-chat",
] as const;

export function isContractCreateImportMethod(
  value: string | null | undefined,
): value is ContractCreateImportMethod {
  return value === "text" || value === "screenshot" || value === "wechat";
}

export function isOcrImportMethod(method: ContractCreateImportMethod) {
  return method === "screenshot" || method === "wechat";
}

export function resolveContractCreateImportMethod(
  value: string | null | undefined,
): ResolveImportMethodResult {
  if (value == null || value === "") {
    return { method: "text", isKnown: true };
  }

  if (isContractCreateImportMethod(value)) {
    return { method: value, isKnown: true };
  }

  return { method: "text", isKnown: false };
}

export function buildContractCreateRoute(
  method: ContractCreateMethod,
  options: BuildCreateRouteOptions = {},
) {
  const params = new URLSearchParams();
  const flowContext = options.flowContext || "standalone";
  const templateId =
    typeof options.templateId === "string" ? options.templateId.trim() : "";

  if (flowContext === "dashboard") {
    params.set("ctx", "dashboard");
  }
  if (templateId) {
    params.set("templateId", templateId);
  }

  if (method === "ai-chat") {
    const query = params.toString();
    return `/create/ai-chat${query ? `?${query}` : ""}`;
  }

  params.set("method", method);
  const query = params.toString();
  return `/create/import?${query}`;
}
