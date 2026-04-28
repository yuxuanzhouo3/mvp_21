"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/components/user-context";
import { useLanguage } from "@/components/language-provider";
import { getAuthClient } from "@/lib/auth/client";
import { detectCNLoginRuntime } from "@/lib/auth/client-runtime";
import {
  buildMiniProgramLoginCallbackKey,
  hasMiniProgramLoginCredential,
  normalizeMiniProgramLoginPayload,
  readMiniProgramLoginPayloadFromSearch,
} from "@/lib/auth/wechat-mini-bridge";
import { useTranslations } from "@/lib/i18n";
import { RegionType } from "@/lib/architecture-modules/core/types";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";

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

const MINI_PROGRAM_LOGIN_PAGE =
  process.env.NEXT_PUBLIC_WECHAT_MINI_LOGIN_PAGE || "/pages/webshell/login";

function AuthPageContent() {
  const authClient = useMemo(() => getAuthClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useUser();
  const { language, deploymentRegion } = useLanguage();
  const t = useTranslations(language);
  const ui = t.authPage;
  const { config, loading: configLoading } = useAuthConfig();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const debugRegion = searchParams.get("debug");
  const requestedRedirect = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToPrivacy, setAgreeToPrivacy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [cnPhoneLoginExpanded, setCnPhoneLoginExpanded] = useState(false);
  const [cnMiniProgramEmailLogin, setCnMiniProgramEmailLogin] = useState(false);
  const [forgotStep, setForgotStep] = useState<"off" | "request" | "verify" | "reset">("off");
  const [region, setRegion] = useState<RegionType>(
    deploymentRegion === "CN" ? RegionType.CHINA : RegionType.USA,
  );
  const [isMiniProgramEnv, setIsMiniProgramEnv] = useState(false);
  const [miniEnvResolved, setMiniEnvResolved] = useState(false);
  const [miniLoginLoading, setMiniLoginLoading] = useState(false);
  const authActionLockRef = useRef(false);
  const redirectingRef = useRef(false);
  const cnManualSignInChoiceRef = useRef(false);
  const miniLoginTimeoutRef = useRef<number | null>(null);
  const miniLoginRequestIdRef = useRef("");
  const handledMiniLoginCallbackKeysRef = useRef<Set<string>>(new Set());
  const smsAvailability = config.availability?.sms;
  const miniProgramWechatAvailability = config.availability?.miniProgramWechat;
  const phoneOtpEnabledInCn =
    configLoading || smsAvailability?.enabled !== false;
  const miniProgramWechatEnabledInCn =
    configLoading || miniProgramWechatAvailability?.enabled !== false;
  const otpMethodAvailable =
    region === RegionType.CHINA ? phoneOtpEnabledInCn : false;
  const googleAvailability = config.availability?.google;
  const googleReadiness = config.oauthReadiness?.providers.google;
  const isCnPhoneOtpView = region === RegionType.CHINA && cnPhoneLoginExpanded;
  const useOtpLogin = region === RegionType.CHINA ? isCnPhoneOtpView : loginMethod === "otp";
  const useMiniWechatLogin =
    region === RegionType.CHINA &&
    isMiniProgramEnv &&
    !cnMiniProgramEmailLogin;
  const thirdPartyUnavailable =
    region !== RegionType.CHINA &&
    (
      !config.features.googleAuth ||
      googleAvailability?.enabled === false ||
      googleReadiness?.status === "not_ready"
    );
  const thirdPartyUnavailableReason =
    googleReadiness?.status === "not_ready"
      ? googleReadiness.reason
      : googleAvailability?.reason;

  const buildUrl = useCallback((path: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (debugRegion) params.set("debug", debugRegion);
    if (extra) Object.entries(extra).forEach(([k, v]) => params.set(k, v));
    const q = params.toString();
    return q ? `${path}?${q}` : path;
  }, [debugRegion]);

  const postAuthPath = useMemo(() => {
    const normalized = requestedRedirect?.split("?")[0] || "";
    if (normalized.startsWith("/") && !normalized.startsWith("//")) return normalized;
    return "/dashboard";
  }, [requestedRedirect]);
  const postAuthUrl = useMemo(() => buildUrl(postAuthPath), [buildUrl, postAuthPath]);
  const authOrigin = useMemo(() => {
    if (typeof window === "undefined") return "";

    const currentOrigin = window.location.origin;
    // Keep OAuth callback host aligned with the current runtime origin to avoid
    // cross-host 308 canonical redirects breaking Supabase PKCE/session exchange.
    return currentOrigin;
  }, []);

  useEffect(() => {
    if (!configLoading) {
      setRegion(config.region === "CN" ? RegionType.CHINA : RegionType.USA);
    }
  }, [config.region, configLoading]);

  useEffect(() => {
    if (!otpMethodAvailable && loginMethod === "otp") {
      setLoginMethod("password");
      setOtp("");
      setOtpSent(false);
    }
  }, [loginMethod, otpMethodAvailable]);

  useEffect(() => {
    if (region !== RegionType.CHINA && cnPhoneLoginExpanded) {
      setCnPhoneLoginExpanded(false);
      return;
    }
  }, [cnPhoneLoginExpanded, region]);

  useEffect(() => {
    if (region !== RegionType.CHINA || typeof window === "undefined") {
      return;
    }

    const wxGlobal = (window as any).wx;
    if (wxGlobal?.miniProgram) {
      return;
    }

    const existingScript = document.querySelector(
      'script[data-wechat-js-sdk="true"]',
    ) as HTMLScriptElement | null;
    if (existingScript) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
    script.async = true;
    script.defer = true;
    script.setAttribute("data-wechat-js-sdk", "true");
    document.head.appendChild(script);
  }, [region]);

  useEffect(() => {
    if (region !== RegionType.CHINA) {
      setIsMiniProgramEnv(false);
      setMiniEnvResolved(true);
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let settled = false;
    const setEnv = (mini: boolean) => {
      if (settled) return;
      settled = true;
      setIsMiniProgramEnv(mini);
      setMiniEnvResolved(true);
    };

    if (detectCNLoginRuntime() === "mini_program") {
      setEnv(true);
      return;
    }

    const checkBridgeEnv = () => {
      const bridge = (window as any).WeixinJSBridge;
      if (!bridge || typeof bridge.invoke !== "function") {
        return false;
      }
      bridge.invoke("getEnv", {}, (res: { miniprogram?: boolean }) => {
        setEnv(Boolean(res?.miniprogram));
      });
      return true;
    };

    if (checkBridgeEnv()) {
      const timer = window.setTimeout(() => setEnv(false), 1000);
      return () => window.clearTimeout(timer);
    }

    const handleBridgeReady = () => {
      if (!checkBridgeEnv()) {
        setEnv(false);
      }
    };

    const timer = window.setTimeout(() => setEnv(false), 1200);
    document.addEventListener("WeixinJSBridgeReady", handleBridgeReady, { once: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("WeixinJSBridgeReady", handleBridgeReady);
    };
  }, [region]);

  useEffect(() => {
    if (mode !== "signin") {
      cnManualSignInChoiceRef.current = false;
      return;
    }

    if (
      region !== RegionType.CHINA ||
      !miniEnvResolved ||
      cnManualSignInChoiceRef.current
    ) {
      return;
    }

    if (isMiniProgramEnv) {
      if (
        cnPhoneLoginExpanded ||
        loginMethod !== "password" ||
        cnMiniProgramEmailLogin
      ) {
        setCnPhoneLoginExpanded(false);
        setCnMiniProgramEmailLogin(false);
        setLoginMethod("password");
      }
      return;
    }

    if (
      !cnPhoneLoginExpanded ||
      loginMethod !== "otp" ||
      cnMiniProgramEmailLogin
    ) {
      setOtp("");
      setOtpSent(false);
      setCnPhoneLoginExpanded(true);
      setCnMiniProgramEmailLogin(false);
      setLoginMethod("otp");
    }
  }, [
    cnMiniProgramEmailLogin,
    cnPhoneLoginExpanded,
    isMiniProgramEnv,
    loginMethod,
    miniEnvResolved,
    mode,
    region,
  ]);

  const clearFeedback = useCallback(() => {
    setNotice("");
    setError("");
  }, []);

  const clearMiniLoginTimeout = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (miniLoginTimeoutRef.current !== null) {
      window.clearTimeout(miniLoginTimeoutRef.current);
      miniLoginTimeoutRef.current = null;
    }
  }, []);

  const clearMiniLoginQuery = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const cleanedUrl = new URL(window.location.href);
    MINI_PROGRAM_CALLBACK_QUERY_KEYS.forEach((key) =>
      cleanedUrl.searchParams.delete(key),
    );
    window.history.replaceState({}, "", cleanedUrl.toString());
  }, []);

  const msg = useCallback((raw: unknown) => {
    const m = raw instanceof Error ? raw.message : String(raw || "");
    const lower = m.toLowerCase();
    if (!m) return ui.operationFailed;
    if (lower.includes("already")) return ui.emailAlreadyRegistered;
    if (lower.includes("invalid email")) return ui.invalidEmailFormat;
    if (lower.includes("weak password") || lower.includes("security requirements")) return t.auth.passwordTooShort;
    if (lower.includes("google")) return t.auth.googleLoginFailed;
    return m;
  }, [t.auth.googleLoginFailed, t.auth.passwordTooShort, ui.emailAlreadyRegistered, ui.invalidEmailFormat, ui.operationFailed]);

  const requirePrivacy = () => {
    if (region === RegionType.CHINA && !agreeToPrivacy) {
      setError(ui.privacyConsentRequired);
      return false;
    }
    return true;
  };

  const resetForgot = useCallback(() => {
    setForgotStep("off");
    setResetOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
  }, []);

  const switchToCnEmailLogin = () => {
    cnManualSignInChoiceRef.current = true;
    clearFeedback();
    resetForgot();
    setCnPhoneLoginExpanded(false);
    setCnMiniProgramEmailLogin(false);
    setLoginMethod("password");
    setOtp("");
    setOtpSent(false);
  };

  const switchToCnPhoneLogin = () => {
    cnManualSignInChoiceRef.current = true;
    clearFeedback();
    resetForgot();
    setCnPhoneLoginExpanded(true);
    setCnMiniProgramEmailLogin(false);
    setLoginMethod("otp");
    setOtp("");
    setOtpSent(false);
  };

  const switchToCnMiniProgramEmailLogin = () => {
    cnManualSignInChoiceRef.current = true;
    clearFeedback();
    resetForgot();
    setCnPhoneLoginExpanded(false);
    setCnMiniProgramEmailLogin(true);
    setLoginMethod("password");
    setOtp("");
    setOtpSent(false);
  };

  const switchToCnMiniProgramWechatLogin = () => {
    cnManualSignInChoiceRef.current = true;
    clearFeedback();
    resetForgot();
    setCnPhoneLoginExpanded(false);
    setCnMiniProgramEmailLogin(false);
    setLoginMethod("password");
    setOtp("");
    setOtpSent(false);
  };

  // Legacy no-op bridge kept only so the old mini-program login branch remains
  // type-safe while the real entrypoint delegates to requestMiniProgramWxLoginV2.
  const postMessageRequested = () => false;

  const requestMiniProgramWxLogin = () => {
    return requestMiniProgramWxLoginV2();

    if (loading || miniLoginLoading) {
      return;
    }

    if (!requirePrivacy()) {
      return;
    }

    if (!miniProgramWechatEnabledInCn) {
      setError(
        miniProgramWechatAvailability?.reason ||
          "微信小程序登录尚未完成配置，请先补充小程序 AppID 与 Secret。",
      );
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    clearFeedback();
    const wx = (window as any).wx;
    const callbackCleanUrl = new URL(window.location.href);
    MINI_PROGRAM_CALLBACK_QUERY_KEYS.forEach((key) =>
      callbackCleanUrl.searchParams.delete(key),
    );
    const returnUrl = callbackCleanUrl.toString();
    const requestId = `wx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    miniLoginRequestIdRef.current = requestId;

    clearMiniLoginTimeout();
    setMiniLoginLoading(true);
    setNotice("正在拉起微信登录，请在小程序中完成授权...");

    miniLoginTimeoutRef.current = window.setTimeout(() => {
      setMiniLoginLoading(false);
      setNotice("");
      setError(
        "未收到小程序回传登录凭证（mpCode/token）。请检查小程序宿主是否处理 REQUEST_WX_LOGIN 并回传到当前页面。",
      );
      console.warn("[auth] mini-program login callback timeout", {
        requestId,
        returnUrl,
      });
    }, 15000);

    if (wx?.miniProgram?.navigateTo) {
      const connector = MINI_PROGRAM_LOGIN_PAGE.includes("?") ? "&" : "?";
      const loginPageUrl =
        `${MINI_PROGRAM_LOGIN_PAGE}${connector}` +
        `requestId=${encodeURIComponent(requestId)}` +
        `&returnUrl=${encodeURIComponent(returnUrl)}`;

      wx.miniProgram.navigateTo({
        url: loginPageUrl,
        success: () => {
          console.info("[auth] mini-program login requested", {
            requestId,
            returnUrl,
            loginPage: loginPageUrl,
            requestMode: "navigateTo",
          });
        },
        fail: (navigationError: { errMsg?: string } | unknown) => {
          console.warn("[auth] miniProgram.navigateTo failed", navigationError);
          if (!postMessageRequested()) {
            clearMiniLoginTimeout();
            setMiniLoginLoading(false);
            setNotice("");
            setError("微信登录拉起失败，请检查小程序登录页配置。");
          }
        },
      });

      postMessageRequested();
      return;
    }

    if (postMessageRequested()) {
      return;
    }

    if (false && wx?.miniProgram?.postMessage) {
      try {
        wx.miniProgram.postMessage({
          data: {
            type: "REQUEST_WX_LOGIN",
            requestId,
            returnUrl,
          },
        });
        console.info("[auth] mini-program login requested", {
          requestId,
          returnUrl,
          hasNavigateTo: Boolean(wx?.miniProgram?.navigateTo),
        });
      } catch (postMessageError) {
        clearMiniLoginTimeout();
        setMiniLoginLoading(false);
        setNotice("");
        setError("微信登录消息发送失败，请稍后重试。");
        console.error("[auth] miniProgram.postMessage failed", postMessageError);
      }
      return;
    }

    clearMiniLoginTimeout();
    setMiniLoginLoading(false);
    setNotice("");
    setError("当前环境未注入小程序通信能力，无法拉起微信登录。");
  };

  const requestMiniProgramWxLoginV2 = () => {
    if (loading || miniLoginLoading) {
      return;
    }

    if (!requirePrivacy()) {
      return;
    }

    if (!miniProgramWechatEnabledInCn) {
      setError(
        miniProgramWechatAvailability?.reason ||
          "微信小程序登录配置不完整，请先检查小程序登录页路径、AppID 和 Secret。",
      );
      return;
    }

    if (!MINI_PROGRAM_LOGIN_PAGE) {
      setError("未配置 NEXT_PUBLIC_WECHAT_MINI_LOGIN_PAGE，无法拉起小程序登录页。");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const wx = (window as any).wx;
    if (!wx?.miniProgram?.navigateTo) {
      setError("当前环境未注入可用的小程序跳转能力，无法拉起微信登录页。");
      return;
    }

    clearFeedback();

    const callbackCleanUrl = new URL(window.location.href);
    MINI_PROGRAM_CALLBACK_QUERY_KEYS.forEach((key) =>
      callbackCleanUrl.searchParams.delete(key),
    );

    const returnUrl = callbackCleanUrl.toString();
    const requestId = `wx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    miniLoginRequestIdRef.current = requestId;

    clearMiniLoginTimeout();
    setMiniLoginLoading(true);
    setNotice("正在拉起微信登录，请在小程序中完成授权...");

    miniLoginTimeoutRef.current = window.setTimeout(() => {
      setMiniLoginLoading(false);
      setNotice("");
      setError("未收到小程序回传登录凭证（mpCode/token）。请检查小程序宿主登录页是否已完成微信登录并回传到当前页面。");
      console.warn("[auth] mini-program login callback timeout", {
        requestId,
        returnUrl,
        loginPage: MINI_PROGRAM_LOGIN_PAGE,
      });
    }, 15000);

    const connector = MINI_PROGRAM_LOGIN_PAGE.includes("?") ? "&" : "?";
    const loginPageUrl =
      `${MINI_PROGRAM_LOGIN_PAGE}${connector}` +
      `requestId=${encodeURIComponent(requestId)}` +
      `&returnUrl=${encodeURIComponent(returnUrl)}`;

    wx.miniProgram.navigateTo({
      url: loginPageUrl,
      success: () => {
        console.info("[auth] mini-program login requested", {
          requestId,
          returnUrl,
          loginPage: loginPageUrl,
          requestMode: "navigateTo",
        });
      },
      fail: (navigationError: { errMsg?: string } | unknown) => {
        clearMiniLoginTimeout();
        setMiniLoginLoading(false);
        setNotice("");
        const details =
          typeof navigationError === "object" &&
          navigationError &&
          "errMsg" in navigationError &&
          typeof navigationError.errMsg === "string"
            ? ` (${navigationError.errMsg})`
            : "";
        setError(`微信登录页拉起失败，请检查小程序页面路径配置${details}`);
        console.warn("[auth] miniProgram.navigateTo failed", {
          requestId,
          returnUrl,
          loginPage: loginPageUrl,
          navigationError,
        });
      },
    });
  };

  const goSignedIn = useCallback(() => {
    if (redirectingRef.current) {
      return;
    }

    redirectingRef.current = true;

    if (region === RegionType.CHINA && typeof window !== "undefined") {
      window.location.replace(postAuthUrl);
      return;
    }

    router.replace(postAuthUrl, { scroll: false });
  }, [postAuthUrl, region, router]);

  const navigate = useCallback(
    (path: string) => {
      router.push(path, { scroll: false });
    },
    [router],
  );

  const runLockedAuthAction = useCallback(async (action: () => Promise<void>) => {
    if (authActionLockRef.current) {
      return;
    }

    authActionLockRef.current = true;
    try {
      await action();
    } finally {
      authActionLockRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      authActionLockRef.current = false;
    }
  }, [loading]);

  useEffect(() => {
    if (!user) {
      redirectingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!userLoading && user) {
      goSignedIn();
    }
  }, [goSignedIn, user, userLoading]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePageShow = () => {
      redirectingRef.current = false;
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const consumeMiniLoginCallback = useCallback(
    async (rawPayload: unknown, source: string) => {
      if (region !== RegionType.CHINA || typeof window === "undefined") {
        return false;
      }

      const payload =
        typeof rawPayload === "string"
          ? readMiniProgramLoginPayloadFromSearch(rawPayload)
          : normalizeMiniProgramLoginPayload(rawPayload);

      if (!payload) {
        return false;
      }

      if (
        payload.requestId &&
        miniLoginRequestIdRef.current &&
        payload.requestId !== miniLoginRequestIdRef.current
      ) {
        console.info("[auth] ignored stale mini-program login callback", {
          source,
          requestId: payload.requestId,
          expectedRequestId: miniLoginRequestIdRef.current,
        });
        return false;
      }

      if (payload.error && !hasMiniProgramLoginCredential(payload)) {
        clearMiniLoginTimeout();
        setMiniLoginLoading(false);
        setNotice("");
        setError(payload.error);
        return true;
      }

      if (!hasMiniProgramLoginCredential(payload)) {
        return false;
      }

      const callbackKey = buildMiniProgramLoginCallbackKey(payload);
      if (handledMiniLoginCallbackKeysRef.current.has(callbackKey)) {
        return true;
      }
      handledMiniLoginCallbackKeysRef.current.add(callbackKey);

      clearMiniLoginTimeout();
      setMiniLoginLoading(true);
      setNotice("");
      setError("");
      setNotice("正在处理微信登录结果...");
      console.info("[auth] mini-program login callback received", {
        source,
        requestId: payload.requestId || miniLoginRequestIdRef.current || "unknown",
        hasToken: Boolean(payload.token || payload.accessToken),
        hasCode: Boolean(payload.mpCode || payload.code),
      });

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
          if (!wxLoginResponse.ok || !wxLoginResult?.success || !wxLoginResult?.token) {
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

        const { saveAuthState } = await import("@/lib/auth/auth-state-manager");
        saveAuthState(
          finalAccessToken,
          finalRefreshToken,
          finalUser,
          finalTokenMeta,
        );

        clearMiniLoginQuery();
        miniLoginRequestIdRef.current = "";
        setNotice("");
        redirectingRef.current = false;
        goSignedIn();
      } catch (callbackError) {
        handledMiniLoginCallbackKeysRef.current.delete(callbackKey);
        setNotice("");
        setError(msg(callbackError) || "微信登录失败，请稍后重试");
      } finally {
        setMiniLoginLoading(false);
      }

      return true;
    },
    [
      clearMiniLoginQuery,
      clearMiniLoginTimeout,
      goSignedIn,
      msg,
      region,
    ],
  );

  useEffect(() => {
    if (region !== RegionType.CHINA || typeof window === "undefined") {
      return;
    }

    void consumeMiniLoginCallback(window.location.search, "query");
  }, [consumeMiniLoginCallback, region, searchParams]);

  useEffect(() => {
    if (region !== RegionType.CHINA || typeof window === "undefined") {
      return;
    }

    const handleWindowMessage = (event: MessageEvent) => {
      void consumeMiniLoginCallback(event.data, "window-message");
    };

    const handleBridgeSuccess = (payload: unknown) => {
      if (typeof payload === "string") {
        void consumeMiniLoginCallback({ mpCode: payload }, "global-callback");
        return;
      }
      void consumeMiniLoginCallback(payload, "global-callback");
    };

    const handleBridgeError = (payload: unknown) => {
      const normalized =
        typeof payload === "string"
          ? null
          : normalizeMiniProgramLoginPayload(payload);
      const errorMessage =
        normalized?.error ||
        (payload instanceof Error
          ? payload.message
          : String(payload || "微信登录失败，请稍后重试"));

      clearMiniLoginTimeout();
      setMiniLoginLoading(false);
      setNotice("");
      setError(errorMessage);
    };

    const windowRef = window as any;
    const previousMiniSuccess = windowRef.onMiniProgramWechatLoginSuccess;
    const previousWechatSuccess = windowRef.onWeChatLoginSuccess;
    const previousWechatMiniSuccess = windowRef.onWechatMiniProgramLoginSuccess;
    const previousMiniError = windowRef.onMiniProgramWechatLoginError;

    window.addEventListener("message", handleWindowMessage);
    windowRef.onMiniProgramWechatLoginSuccess = handleBridgeSuccess;
    windowRef.onWeChatLoginSuccess = handleBridgeSuccess;
    windowRef.onWechatMiniProgramLoginSuccess = handleBridgeSuccess;
    windowRef.onMiniProgramWechatLoginError = handleBridgeError;

    return () => {
      window.removeEventListener("message", handleWindowMessage);
      windowRef.onMiniProgramWechatLoginSuccess = previousMiniSuccess;
      windowRef.onWeChatLoginSuccess = previousWechatSuccess;
      windowRef.onWechatMiniProgramLoginSuccess = previousWechatMiniSuccess;
      windowRef.onMiniProgramWechatLoginError = previousMiniError;
    };
  }, [clearMiniLoginTimeout, consumeMiniLoginCallback, region]);

  useEffect(() => {
    return;

    if (region !== RegionType.CHINA || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get("token") || "";
    const callbackOpenId = params.get("openid") || "";
    const callbackCode = params.get("mpCode") || "";
    const callbackNickName = params.get("mpNickName") || "";
    const callbackAvatarUrl = params.get("mpAvatarUrl") || "";

    if (!callbackToken && !callbackCode) {
      return;
    }

    clearMiniLoginTimeout();
    let cancelled = false;

    const consumeMiniLoginCallback = async () => {
      setMiniLoginLoading(true);
      setNotice("");
      setError("");
      setNotice("正在处理微信登录结果...");
      console.info("[auth] mini-program login callback received", {
        requestId: miniLoginRequestIdRef.current || "unknown",
        hasToken: Boolean(callbackToken),
        hasCode: Boolean(callbackCode),
      });

      try {
        let accessToken = callbackToken;
        let openid = callbackOpenId;
        let refreshToken = "";
        let tokenMeta:
          | { accessTokenExpiresIn: number; refreshTokenExpiresIn: number }
          | undefined;
        let userPayload: Record<string, unknown> | undefined;

        if (!accessToken && callbackCode) {
          const wxLoginResponse = await fetch("/api/wxlogin", {
            method: "POST",
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
          if (!wxLoginResponse.ok || !wxLoginResult?.success || !wxLoginResult?.token) {
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: accessToken,
            openid,
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

        const { saveAuthState } = await import("@/lib/auth/auth-state-manager");
        saveAuthState(
          finalAccessToken,
          finalRefreshToken,
          finalUser,
          finalTokenMeta,
        );

        const cleanedUrl = new URL(window.location.href);
        const callbackKeys = [
          "token",
          "openid",
          "expiresIn",
          "mpCode",
          "mpNickName",
          "mpAvatarUrl",
          "mpProfileTs",
        ];
        callbackKeys.forEach((key) => cleanedUrl.searchParams.delete(key));
        window.history.replaceState({}, "", cleanedUrl.toString());

        if (!cancelled) {
          setNotice("");
          redirectingRef.current = false;
          goSignedIn();
        }
      } catch (callbackError) {
        if (!cancelled) {
          setError(
            msg(callbackError) || "微信登录失败，请稍后重试",
          );
        }
      } finally {
        if (!cancelled) {
          setMiniLoginLoading(false);
        }
      }
    };

    void consumeMiniLoginCallback();

    return () => {
      cancelled = true;
    };
  }, [clearMiniLoginTimeout, goSignedIn, msg, region]);

  useEffect(() => {
    return () => {
      clearMiniLoginTimeout();
    };
  }, [clearMiniLoginTimeout]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !requirePrivacy()) return;
    if (region === RegionType.CHINA) {
      const identifier = email.trim();
      const isPhone = /^1[3-9]\d{9}$/.test(identifier);
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      if (isMiniProgramEnv && !isEmail) {
        setError("请输入正确的邮箱");
        return;
      }
      if (!isMiniProgramEnv && !isPhone && !isEmail) {
        setError("请输入正确的手机号或邮箱");
        return;
      }
    }

    await runLockedAuthAction(async () => {
      clearFeedback();
      setLoading(true);
      try {
        const normalizedIdentifier =
          region === RegionType.CHINA ? email.trim() : email;
        const { data, error: err } = await authClient.signInWithPassword({ email: normalizedIdentifier, password });
        if (err) throw err;
        if (region !== RegionType.CHINA && !data?.session?.access_token) {
          throw new Error("No active session was established. Please sign in again.");
        }
        redirectingRef.current = false;
        goSignedIn();
      } catch (err) {
        setError(msg(err) || t.auth.loginFailed);
      } finally {
        setLoading(false);
      }
    });
  };

  const onOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !otpMethodAvailable) return;
    if (region === RegionType.CHINA) {
      const normalizedPhone = email.trim();
      if (!/^1[3-9]\d{9}$/.test(normalizedPhone)) {
        setError("请输入正确的手机号");
        return;
      }
    }

    await runLockedAuthAction(async () => {
      clearFeedback();
      setLoading(true);
      try {
        if (!otpSent) {
          const { error: err } = await authClient.signInWithOtp({ email });
          if (err) throw err;
          setOtpSent(true);
          setNotice(
            region === RegionType.CHINA
              ? "验证码已发送到你的手机号。"
              : t.auth.otpSent,
          );
        } else {
          const { error: err } = await authClient.verifyOtp({ email, token: otp, type: region === RegionType.CHINA ? "sms" : "email" });
          if (err) throw err;
          redirectingRef.current = false;
          goSignedIn();
        }
      } catch (err) {
        setError(msg(err));
      } finally {
        setLoading(false);
      }
    });
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearFeedback();
    if (!requirePrivacy()) return;
    if (password !== confirmPassword) return void setError(t.auth.passwordMismatch);
    if (password.length < 6) return void setError(t.auth.passwordTooShort);
    setLoading(true);
    try {
      if (region === RegionType.CHINA) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, confirmPassword, fullName: email.split("@")[0] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.details || data.error || t.auth.registerFailed);
        setNotice(ui.registerSuccessCn);
      } else {
        const { error: err } = await authClient.signUp({
          email,
          password,
          options: {
            data: { name: email.split("@")[0] },
            emailRedirectTo: `${authOrigin}${buildUrl("/auth/callback", { redirect: postAuthPath })}`,
          },
        });
        if (err) throw err;
        setNotice(ui.registerSuccessIntl);
      }
      setPassword("");
      setConfirmPassword("");
      setAgreeToPrivacy(false);
      window.setTimeout(() => navigate(buildUrl("/auth", { mode: "signin" })), region === RegionType.CHINA ? 1200 : 3000);
    } catch (err) {
      setError(msg(err));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (loading) return;
    clearFeedback();
    if (thirdPartyUnavailable) {
      setError(thirdPartyUnavailableReason || ui.oauthUnavailable);
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${authOrigin}${buildUrl("/auth/callback", { redirect: postAuthPath })}`;
      let err: Error | null = null;

      if (region !== RegionType.CHINA) {
        const { supabase } = await import("@/lib/integrations/supabase");
        const direct = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        err = direct.error;
      } else {
        const result = await authClient.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        err = result.error;
      }

      // Fallback: if a stale CN auth client is used in an INTL page, directly use Supabase OAuth.
      if (
        err &&
        (
          /not supported in china region/i.test(err.message) ||
          /supabase client not initialized/i.test(err.message)
        )
      ) {
        console.warn("[AuthPage] Google OAuth fallback to Supabase client:", err.message);
        const { supabase } = await import("@/lib/integrations/supabase");
        const fallback = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        err = fallback.error;
      }

      if (err) throw err;
    } catch (err) {
      console.error("[AuthPage] Google OAuth failed:", err);
      setError(msg(err));
      setLoading(false);
    }
  };

  const onResetRequest = async (e?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    if (loading) return;
    setResetToken("");
    if (!email.trim()) {
      setError(t.auth.enterEmail);
      return;
    }
    clearFeedback();
    setLoading(true);
    try {
      if (region === RegionType.CHINA) {
        const response = await fetch("/api/auth/send-reset-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || t.auth.sendOtpFailed);
        }
      } else {
        const { error: err } = await authClient.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: `${authOrigin}${buildUrl("/auth", { mode: "signin" })}` },
        });
        if (err) throw err;
      }
      setForgotStep("verify");
      setNotice(t.auth.otpSent);
    } catch (err) {
      setError(msg(err));
    } finally {
      setLoading(false);
    }
  };

  const onResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!resetOtp) return void setError(t.auth.enterOtpRequired);
    if (!email.trim()) return void setError(t.auth.enterEmail);
    clearFeedback();
    setLoading(true);
    try {
      if (region === RegionType.CHINA) {
        const response = await fetch("/api/auth/verify-reset-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            code: resetOtp.trim(),
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.resetToken) {
          throw new Error(payload?.error || t.auth.verifyOtpFailed);
        }
        setResetToken(payload.resetToken);
      } else {
        const { error: err } = await authClient.verifyOtp({ email, token: resetOtp, type: "email" });
        if (err) throw err;
      }
      setResetOtp("");
      setForgotStep("reset");
      setNotice(ui.otpVerifiedSetPassword);
    } catch (err) {
      setError(msg(err));
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword.length < 6) return void setError(t.auth.passwordTooShort);
    if (newPassword !== confirmNewPassword) return void setError(t.auth.passwordMismatch);
    if (!email.trim()) return void setError(t.auth.enterEmail);
    clearFeedback();
    setLoading(true);
    try {
      if (region === RegionType.CHINA) {
        if (!resetToken) {
          throw new Error(t.auth.otpInvalid);
        }
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            resetToken,
            password: newPassword,
            confirmPassword: confirmNewPassword,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || t.auth.setPasswordFailed);
        }
      } else {
        const { error: err } = await authClient.updateUser({ password: newPassword });
        if (err) throw err;
        await authClient.signOut();
      }
      resetForgot();
      setOtpSent(false);
      setOtp("");
      setLoginMethod("password");
      setPassword("");
      setNotice(t.auth.passwordResetSuccess);
    } catch (err) {
      setError(msg(err));
    } finally {
      setLoading(false);
    }
  };

  const signInButton = loading
    ? !useOtpLogin
      ? t.auth.loggingIn
      : otpSent
        ? t.auth.verifying
        : t.auth.sending
    : !useOtpLogin
      ? t.auth.signInButton
      : otpSent
        ? t.auth.verifyOtp
        : t.auth.sendOtp;
  const showForgotPassword = region === RegionType.CHINA || !useOtpLogin;

  const renderPrivacy = (withForgotLink = false) => (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`privacy-${mode}`}
          checked={agreeToPrivacy}
          onCheckedChange={(checked) => setAgreeToPrivacy(Boolean(checked))}
          className="shrink-0"
        />
        <label htmlFor={`privacy-${mode}`} className="flex-1 cursor-pointer whitespace-nowrap text-sm text-gray-700">
          {ui.consentPrefix}{" "}
          <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(buildUrl("/privacy"))}>{ui.privacyPolicy}</button>{" "}
          {ui.consentConnector}{" "}
          <button type="button" className="text-blue-600 hover:underline" onClick={() => navigate(buildUrl("/terms"))}>{ui.termsOfService}</button>
          {region === RegionType.CHINA ? <span className="ml-1 text-red-600">*</span> : null}
        </label>
        {withForgotLink ? (
          <button
            type="button"
            className="shrink-0 whitespace-nowrap text-sm text-blue-600 hover:underline"
            onClick={() => { clearFeedback(); setForgotStep("request"); }}
          >
            {t.auth.forgotPassword}
          </button>
        ) : null}
      </div>
    </div>
  );

  const forgotForm =
    forgotStep === "request" ? (
      <form onSubmit={onResetRequest} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-email">{t.auth.email}</Label>
          <Input id="reset-email" type="email" placeholder={t.auth.enterEmail} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? t.auth.sending : t.auth.sendOtp}</Button>
        <button type="button" className="w-full text-sm text-blue-600 hover:underline" onClick={() => { clearFeedback(); resetForgot(); }}>{t.auth.backToLogin}</button>
      </form>
    ) : forgotStep === "verify" ? (
      <form onSubmit={onResetVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-verify-email">{t.auth.email}</Label>
          <Input id="reset-verify-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-otp">{t.auth.verifyOtp}</Label>
          <Input id="reset-otp" type="text" placeholder={t.auth.enterOtp} value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} maxLength={6} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? t.auth.verifying : t.auth.verifyOtp}</Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-blue-600 hover:underline" onClick={(e) => { void onResetRequest(e); }} disabled={loading}>{t.auth.resendOtp}</button>
          <button type="button" className="text-blue-600 hover:underline" onClick={() => { clearFeedback(); resetForgot(); }}>{t.auth.backToLogin}</button>
        </div>
      </form>
    ) : (
      <form onSubmit={onResetPassword} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">{t.auth.password}</Label>
          <Input id="new-password" type="password" placeholder={t.auth.enterNewPassword} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-new-password">{t.auth.confirmPassword}</Label>
          <Input id="confirm-new-password" type="password" placeholder={t.auth.confirmNewPassword} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? t.auth.setting : t.auth.setNewPassword}</Button>
        <button type="button" className="w-full text-sm text-blue-600 hover:underline" onClick={() => { clearFeedback(); resetForgot(); }}>{t.auth.backToLogin}</button>
      </form>
    );

  const signInFormEnhanced =
    region === RegionType.CHINA && !miniEnvResolved && forgotStep === "off" ? (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        正在检测登录环境...
      </div>
    ) : useMiniWechatLogin && forgotStep === "off" ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          requestMiniProgramWxLogin();
        }}
        className="space-y-4"
      >
        {!miniProgramWechatEnabledInCn && !configLoading ? (
          <Alert>
            <AlertDescription>
              微信小程序登录暂不可用：
              {miniProgramWechatAvailability?.reason ||
                "请配置 WECHAT_MINIPROGRAM_APPID 和 WECHAT_MINIPROGRAM_SECRET。"}
            </AlertDescription>
          </Alert>
        ) : null}

        <Alert>
          <AlertDescription>
            当前检测到微信小程序环境，请使用微信授权登录。
          </AlertDescription>
        </Alert>

        {miniLoginLoading ? (
          <Alert>
            <AlertDescription>正在同步微信登录状态，请稍候...</AlertDescription>
          </Alert>
        ) : null}

        {renderPrivacy(false)}

        <Button
          type="submit"
          className="w-full"
          disabled={
            loading ||
            miniLoginLoading ||
            !miniEnvResolved ||
            !miniProgramWechatEnabledInCn
          }
        >
          {miniLoginLoading ? "正在拉起微信登录..." : "微信登录"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={switchToCnMiniProgramEmailLogin}
          disabled={loading || miniLoginLoading}
        >
          邮箱登录
        </Button>
        {region === RegionType.CHINA && isMiniProgramEnv && !useMiniWechatLogin ? (
          <div className="space-y-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              onClick={switchToCnMiniProgramWechatLogin}
            >
              微信登录
            </Button>
          </div>
        ) : null}
      </form>
    ) : forgotStep !== "off" ? forgotForm : (
      <form onSubmit={useOtpLogin ? onOtp : onSignIn} className="space-y-4">
        {region === RegionType.CHINA && cnPhoneLoginExpanded && !otpMethodAvailable && !configLoading ? (
          <Alert>
            <AlertDescription>
              手机验证码登录暂不可用：
              {smsAvailability?.reason || "短信服务尚未完成配置。"}
            </AlertDescription>
          </Alert>
        ) : null}

        {useMiniWechatLogin && miniLoginLoading ? (
          <Alert>
            <AlertDescription>正在同步微信登录状态，请稍候...</AlertDescription>
          </Alert>
        ) : null}

        {!useOtpLogin ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="signin-identifier">{region === RegionType.CHINA ? "账号" : t.auth.email}</Label>
              <Input
                id="signin-identifier"
                type={region === RegionType.CHINA ? "text" : "email"}
                placeholder={region === RegionType.CHINA ? "请输入手机号或邮箱" : t.auth.enterEmail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">{t.auth.password}</Label>
              <div className="relative">
                <Input id="signin-password" type={showPassword ? "text" : "password"} placeholder={t.auth.enterPassword} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Label htmlFor={otpSent ? "signin-otp" : "signin-phone"}>
              {otpSent ? t.auth.verifyOtp : region === RegionType.CHINA ? "手机号" : t.auth.email}
            </Label>
            {otpSent ? (
              <Input
                id="signin-otp"
                type="text"
                placeholder={t.auth.enterOtp}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
            ) : (
              <Input
                id="signin-phone"
                type={region === RegionType.CHINA ? "tel" : "email"}
                placeholder={region === RegionType.CHINA ? "请输入手机号" : t.auth.enterEmail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
            {region !== RegionType.CHINA ? (
              <div className="flex justify-end text-sm">
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    clearFeedback();
                    setLoginMethod("password");
                    setOtp("");
                    setOtpSent(false);
                  }}
                >
                  {t.auth.usePasswordLogin}
                </button>
              </div>
            ) : null}
          </div>
        )}
        {renderPrivacy(showForgotPassword)}
        <Button
          type="submit"
          className="w-full"
          disabled={
            loading ||
            miniLoginLoading ||
            (region === RegionType.CHINA && cnPhoneLoginExpanded && !otpMethodAvailable)
          }
        >
          {signInButton}
        </Button>
        {region === RegionType.CHINA && cnPhoneLoginExpanded ? (
          <div className="space-y-3 pt-1">
            <Button type="button" variant="outline" className="h-11 w-full" onClick={switchToCnEmailLogin}>
              账号密码登录
            </Button>
          </div>
        ) : null}
      </form>
    );
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full max-w-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate(buildUrl("/"))}><Home className="mr-1.5 h-4 w-4" /><span className="truncate">{t.auth.backToHome}</span></Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate(buildUrl("/privacy"))}>{ui.privacyPolicy}</Button>
            {debugRegion ? <div className="rounded-lg border border-yellow-300 bg-yellow-100 px-2.5 py-1.5 text-xs sm:text-sm"><div className="font-medium text-yellow-800">{t.auth.debugMode}</div><div className="text-yellow-700">{t.auth.region}: {region === RegionType.CHINA ? t.auth.china : region === RegionType.USA ? t.auth.usa : t.auth.unknown}</div></div> : null}
          </div>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl">{mode === "signup" ? t.auth.signUpTitle : t.auth.signInTitle}</CardTitle>
            <CardDescription className="text-center">{mode === "signup" ? t.auth.signUpDescription : t.auth.signInDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-2">
                <TabsTrigger value="signin" onClick={() => { clearFeedback(); resetForgot(); setCnPhoneLoginExpanded(false); setLoginMethod("password"); navigate(buildUrl("/auth", { mode: "signin" })); }}>{region === RegionType.CHINA ? "登录" : t.auth.login}</TabsTrigger>
                <TabsTrigger value="signup" onClick={() => { clearFeedback(); resetForgot(); setCnPhoneLoginExpanded(false); navigate(buildUrl("/auth", { mode: "signup" })); }}>{t.auth.register}</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-6">
                {signInFormEnhanced}
                {region === RegionType.CHINA && !isMiniProgramEnv && !cnPhoneLoginExpanded && forgotStep === "off" ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      onClick={switchToCnPhoneLogin}
                      variant="outline"
                      className="h-12 w-full"
                      disabled={loading || miniLoginLoading || !miniEnvResolved}
                    >
                      {!miniEnvResolved ? "检测登录环境中..." : useMiniWechatLogin ? "微信登录" : "手机号登录"}
                    </Button>
                  </div>
                ) : null}
                {region !== RegionType.CHINA ? (
                  <>
                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-sm"><span className="bg-white px-4 text-gray-500">{t.auth.or}</span></div></div>
                    <Button onClick={onGoogle} variant="outline" className="h-12 w-full" disabled={loading || configLoading || thirdPartyUnavailable}>{t.auth.googleLogin}</Button>
                  </>
                ) : null}
              </TabsContent>
              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={onSignUp} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="signup-email">{t.auth.email}</Label><Input id="signup-email" type="email" placeholder={t.auth.enterEmail} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                  <div className="space-y-2"><Label htmlFor="signup-password">{t.auth.password}</Label><div className="relative"><Input id="signup-password" type={showPassword ? "text" : "password"} placeholder={t.auth.passwordMinLength} value={password} onChange={(e) => setPassword(e.target.value)} required /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                  <div className="space-y-2"><Label htmlFor="signup-confirm-password">{t.auth.confirmPassword}</Label><div className="relative"><Input id="signup-confirm-password" type={showConfirmPassword ? "text" : "password"} placeholder={t.auth.enterConfirmPassword} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /><button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
                  {renderPrivacy(false)}
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? ui.signingUp : t.auth.signUpButton}</Button>
                </form>
                {region !== RegionType.CHINA ? (
                  <>
                    <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-sm"><span className="bg-white px-4 text-gray-500">{t.auth.or}</span></div></div>
                    <Button onClick={onGoogle} variant="outline" className="h-12 w-full" disabled={loading || configLoading || thirdPartyUnavailable}>{t.auth.googleRegister}</Button>
                  </>
                ) : null}
              </TabsContent>
            </Tabs>
            {notice ? <Alert className="mt-4"><AlertDescription>{notice}</AlertDescription></Alert> : null}
            {error ? <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert> : null}
            {region !== RegionType.CHINA && thirdPartyUnavailable && !configLoading ? (
              <Alert className="mt-4">
                <AlertDescription>{thirdPartyUnavailableReason || ui.oauthUnavailable}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AuthPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <AuthPageContent />
    </Suspense>
  );
}


