export type CNLoginRuntime = "mini_program" | "web";

function hasMiniProgramCallbackPayload(search: string): boolean {
  const query = new URLSearchParams(search);
  return Boolean(
    query.get("token") || query.get("mpCode") || query.get("openid"),
  );
}

export function isWechatMiniProgramEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (hasMiniProgramCallbackPayload(window.location.search || "")) {
    return true;
  }

  const ua = window.navigator.userAgent || "";
  if (/miniprogram/i.test(ua)) {
    return true;
  }

  if (
    (window as unknown as { __wxjs_environment?: string }).__wxjs_environment ===
    "miniprogram"
  ) {
    return true;
  }

  const wx = (window as unknown as { wx?: { miniProgram?: unknown } }).wx;
  return Boolean(wx?.miniProgram);
}

export function detectCNLoginRuntime(): CNLoginRuntime {
  return isWechatMiniProgramEnvironment() ? "mini_program" : "web";
}
