import { describe, expect, test } from "@jest/globals";

import {
  buildMiniProgramLoginCallbackKey,
  hasMiniProgramLoginCredential,
  normalizeMiniProgramLoginPayload,
  readMiniProgramLoginPayloadFromSearch,
} from "@/lib/auth/wechat-mini-bridge";

describe("wechat mini bridge helpers", () => {
  test("normalizes direct callback payload", () => {
    const payload = normalizeMiniProgramLoginPayload({
      requestId: "wx-123",
      mpCode: "mini-code",
      openid: "openid-1",
      mpNickName: "Alice",
      mpAvatarUrl: "https://example.com/avatar.png",
    });

    expect(payload).not.toBeNull();
    expect(payload?.requestId).toBe("wx-123");
    expect(payload?.mpCode).toBe("mini-code");
    expect(payload?.openid).toBe("openid-1");
    expect(payload?.mpNickName).toBe("Alice");
    expect(payload?.mpAvatarUrl).toBe("https://example.com/avatar.png");
    expect(hasMiniProgramLoginCredential(payload)).toBe(true);
  });

  test("normalizes nested postMessage payload", () => {
    const payload = normalizeMiniProgramLoginPayload({
      data: {
        detail: {
          data: {
            type: "WX_LOGIN_SUCCESS",
            token: "access-token",
            openId: "openid-2",
            unionId: "unionid-2",
            nickName: "Bob",
            avatarUrl: "https://example.com/bob.png",
          },
        },
      },
    });

    expect(payload).not.toBeNull();
    expect(payload?.type).toBe("WX_LOGIN_SUCCESS");
    expect(payload?.token).toBe("access-token");
    expect(payload?.openid).toBe("openid-2");
    expect(payload?.unionid).toBe("unionid-2");
    expect(payload?.nickName).toBe("Bob");
    expect(payload?.avatarUrl).toBe("https://example.com/bob.png");
    expect(buildMiniProgramLoginCallbackKey(payload!)).toContain("access-token");
  });

  test("reads callback payload from query string", () => {
    const payload = readMiniProgramLoginPayloadFromSearch(
      "?requestId=wx-789&mpCode=query-code&openid=query-openid",
    );

    expect(payload).not.toBeNull();
    expect(payload?.requestId).toBe("wx-789");
    expect(payload?.mpCode).toBe("query-code");
    expect(payload?.openid).toBe("query-openid");
  });

  test("returns false for payloads without credentials", () => {
    const payload = normalizeMiniProgramLoginPayload({
      type: "REQUEST_WX_LOGIN",
      requestId: "wx-empty",
    });

    expect(payload).not.toBeNull();
    expect(hasMiniProgramLoginCredential(payload)).toBe(false);
  });
});
