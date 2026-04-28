export type CNLoginRuntime = "mini_program" | "web";

export function isWechatMiniProgramEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
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

  return false;
}

export function detectCNLoginRuntime(): CNLoginRuntime {
  return isWechatMiniProgramEnvironment() ? "mini_program" : "web";
}
