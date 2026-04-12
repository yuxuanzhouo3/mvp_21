export type ClientRuntime = "web" | "wechat-mini-program";

type WechatMiniProgramGetEnvResult = {
  miniprogram?: boolean;
};

type WechatMiniProgramApi = {
  getEnv?: (callback: (result: WechatMiniProgramGetEnvResult) => void) => void;
};

type WechatRuntimeApi = {
  miniProgram?: WechatMiniProgramApi;
};

type WindowWithWechatRuntime = Window & {
  __wxjs_environment?: string;
  wx?: WechatRuntimeApi;
};

function hasMiniProgramHintFromUserAgent(userAgent: string): boolean {
  return /\bminiprogram\b/i.test(userAgent);
}

export function detectClientRuntimeSync(): ClientRuntime {
  if (typeof window === "undefined") {
    return "web";
  }

  const targetWindow = window as WindowWithWechatRuntime;
  if (targetWindow.__wxjs_environment === "miniprogram") {
    return "wechat-mini-program";
  }

  if (hasMiniProgramHintFromUserAgent(navigator.userAgent || "")) {
    return "wechat-mini-program";
  }

  return "web";
}

export async function detectClientRuntime(timeoutMs = 500): Promise<ClientRuntime> {
  const syncRuntime = detectClientRuntimeSync();
  if (syncRuntime === "wechat-mini-program") {
    return syncRuntime;
  }

  if (typeof window === "undefined") {
    return "web";
  }

  const targetWindow = window as WindowWithWechatRuntime;
  const miniProgramApi = targetWindow.wx?.miniProgram;
  const getEnv = miniProgramApi?.getEnv;
  if (!getEnv) {
    return "web";
  }

  return new Promise<ClientRuntime>((resolve) => {
    let finished = false;
    const complete = (runtime: ClientRuntime) => {
      if (finished) {
        return;
      }
      finished = true;
      resolve(runtime);
    };

    const timer = window.setTimeout(() => complete("web"), timeoutMs);

    try {
      getEnv((result) => {
        window.clearTimeout(timer);
        complete(result?.miniprogram ? "wechat-mini-program" : "web");
      });
    } catch {
      window.clearTimeout(timer);
      complete("web");
    }
  });
}
