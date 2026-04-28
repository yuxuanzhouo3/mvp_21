export const CONTRACT_CREATE_METHODS = [
  "text",
  "screenshot",
  "wechat",
  "ai-chat",
] as const;

export type ContractCreateMethod = (typeof CONTRACT_CREATE_METHODS)[number];
export type ContractCreateImportMethod = Exclude<ContractCreateMethod, "ai-chat">;

export interface ContractCreateRouteOptions {
  flowContext?: string;
  templateId?: string;
}

export function isContractCreateImportMethod(
  value: unknown,
): value is ContractCreateImportMethod {
  return value === "text" || value === "screenshot" || value === "wechat";
}

export function isOcrImportMethod(
  method: ContractCreateImportMethod,
): boolean {
  return method === "screenshot" || method === "wechat";
}

export function resolveContractCreateImportMethod(
  value: unknown,
): {
  method: ContractCreateImportMethod;
  isKnown: boolean;
} {
  if (value === undefined || value === null || value === "") {
    return { method: "text", isKnown: true };
  }

  if (isContractCreateImportMethod(value)) {
    return { method: value, isKnown: true };
  }

  return { method: "text", isKnown: false };
}

function appendCommonParams(
  searchParams: URLSearchParams,
  options?: ContractCreateRouteOptions,
) {
  if (options?.flowContext) {
    searchParams.set("ctx", options.flowContext);
  }
  if (options?.templateId) {
    searchParams.set("templateId", options.templateId);
  }
}

export function buildContractCreateRoute(
  method: ContractCreateMethod,
  options?: ContractCreateRouteOptions,
): string {
  if (method === "ai-chat") {
    const params = new URLSearchParams();
    appendCommonParams(params, options);
    return `/create/ai-chat${params.size ? `?${params.toString()}` : ""}`;
  }

  const params = new URLSearchParams();
  appendCommonParams(params, options);
  params.set("method", method);
  return `/create/import?${params.toString()}`;
}
