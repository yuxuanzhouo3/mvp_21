"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { saveAuthState } from "@/lib/auth/auth-state-manager";
import {
  buildMiniProgramLoginCallbackKey,
  hasMiniProgramLoginCredential,
  readMiniProgramLoginPayloadFromSearch,
} from "@/lib/auth/wechat-mini-bridge";
import { isChinaRegion } from "@/lib/config/region";

const MINI_PROGRAM_CALLBACK_QUERY_KEYS = [
  "token",
  "openid",
  "unionid",
  "expiresIn",
  "mpCode",
  "code",
  "mpNickName",
  "nickName",
  "mpAvatarUrl",
  "avatarUrl",
  "mpProfileTs",
  "requestId",
] as const;

function clearMiniProgramCallbackQuery() {
  const cleanedUrl = new URL(window.location.href);
  MINI_PROGRAM_CALLBACK_QUERY_KEYS.forEach((key) =>
    cleanedUrl.searchParams.delete(key),
  );
  window.history.replaceState({}, "", cleanedUrl.toString());
}

export function WechatMiniGlobalCallback() {
  const pathname = usePathname();
  const handledCallbackKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isChinaRegion() ||
      pathname === "/auth"
    ) {
      return;
    }

    const payload = readMiniProgramLoginPayloadFromSearch(
      window.location.search || "",
    );
    if (!payload || !hasMiniProgramLoginCredential(payload)) {
      return;
    }

    const callbackKey = buildMiniProgramLoginCallbackKey(payload);
    if (handledCallbackKeysRef.current.has(callbackKey)) {
      return;
    }
    handledCallbackKeysRef.current.add(callbackKey);

    let cancelled = false;

    const consumeCallback = async () => {
      try {
        let accessToken = payload.token || payload.accessToken;
        let openid = payload.openid;
        let refreshToken = "";
        let tokenMeta:
          | { accessTokenExpiresIn: number; refreshTokenExpiresIn: number }
          | undefined;
        let userPayload: Record<string, unknown> | undefined;
        const callbackCode = payload.mpCode || payload.code;
        const callbackNickName = payload.mpNickName || payload.nickName;
        const callbackAvatarUrl = payload.mpAvatarUrl || payload.avatarUrl;

        if (!accessToken && callbackCode) {
          const wxLoginResponse = await fetch("/api/wxlogin", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              code: callbackCode,
              nickName: callbackNickName,
              avatarUrl: callbackAvatarUrl,
            }),
          });
          const wxLoginResult = await wxLoginResponse.json();
          if (
            !wxLoginResponse.ok ||
            !wxLoginResult?.success ||
            !wxLoginResult?.token
          ) {
            throw new Error(wxLoginResult?.error || "微信登录失败，请重试");
          }

          accessToken = String(wxLoginResult.token || "");
          openid = String(wxLoginResult.openid || "");
          refreshToken = String(wxLoginResult.refreshToken || "");
          tokenMeta = wxLoginResult.tokenMeta;
          userPayload = wxLoginResult.user;
        }

        if (!accessToken) {
          throw new Error("未获取到有效登录令牌");
        }

        const mpCallbackResponse = await fetch("/api/auth/mp-callback", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: accessToken,
            openid,
            unionid: payload.unionid,
            nickName: callbackNickName,
            avatarUrl: callbackAvatarUrl,
          }),
        });
        const mpCallbackResult = await mpCallbackResponse.json();
        if (!mpCallbackResponse.ok || !mpCallbackResult?.success) {
          throw new Error(mpCallbackResult?.error || "小程序登录回调失败");
        }

        const finalAccessToken = String(
          mpCallbackResult.accessToken || accessToken,
        );
        const finalRefreshToken = String(
          mpCallbackResult.refreshToken || refreshToken || finalAccessToken,
        );
        const finalTokenMeta =
          mpCallbackResult.tokenMeta ||
          tokenMeta || {
            accessTokenExpiresIn: 3600,
            refreshTokenExpiresIn: 604800,
          };
        const finalUser =
          mpCallbackResult.user ||
          userPayload || {
            id: "",
            email: "",
            name: "微信用户",
            avatar: callbackAvatarUrl,
          };

        if (cancelled) {
          return;
        }

        saveAuthState(
          finalAccessToken,
          finalRefreshToken,
          finalUser,
          finalTokenMeta,
        );
        clearMiniProgramCallbackQuery();
        window.location.replace("/dashboard");
      } catch (error) {
        handledCallbackKeysRef.current.delete(callbackKey);
        console.error(
          "[WechatMiniGlobalCallback] Failed to consume callback:",
          error,
        );
      }
    };

    void consumeCallback();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
