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
import { useTranslations } from "@/lib/i18n";
import { RegionType } from "@/lib/architecture-modules/core/types";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { useAuthConfig } from "@/lib/hooks/useAuthConfig";

function AuthPageContent() {
  const authClient = useMemo(() => getAuthClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useUser();
  const { language } = useLanguage();
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
  const [cnLoginChannel, setCnLoginChannel] = useState<"email" | "phone">("email");
  const [forgotStep, setForgotStep] = useState<"off" | "request" | "verify" | "reset">("off");
  const [region, setRegion] = useState<RegionType>(isChinaDeployment() ? RegionType.CHINA : RegionType.USA);
  const authActionLockRef = useRef(false);
  const redirectingRef = useRef(false);
  const supportsOtp = region === RegionType.CHINA;
  const smsAvailability = config.availability?.sms;
  const phoneOtpEnabledInCn =
    configLoading || smsAvailability?.enabled !== false;
  const otpMethodAvailable =
    region === RegionType.CHINA ? phoneOtpEnabledInCn : supportsOtp;
  const loginMethodOtpLabel =
    region === RegionType.CHINA ? "验证码登录" : t.auth.sendOtp;
  const loginIdentifierLabel =
    region === RegionType.CHINA && cnLoginChannel === "phone" ? "手机号" : t.auth.email;
  const loginIdentifierPlaceholder =
    region === RegionType.CHINA && cnLoginChannel === "phone"
      ? "请输入手机号"
      : t.auth.enterEmail;
  const loginIdentifierType =
    region === RegionType.CHINA && cnLoginChannel === "phone" ? "tel" : "email";
  const thirdPartyUnavailable =
    region !== RegionType.CHINA && !config.features.googleAuth;

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

  useEffect(() => {
    setRegion(isChinaDeployment() ? RegionType.CHINA : RegionType.USA);
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
    if (region !== RegionType.CHINA && cnLoginChannel !== "email") {
      setCnLoginChannel("email");
      setLoginMethod("password");
      setOtp("");
      setOtpSent(false);
      return;
    }

    if (region === RegionType.CHINA && cnLoginChannel === "email" && loginMethod === "otp") {
      setLoginMethod("password");
      setOtp("");
      setOtpSent(false);
    }
  }, [cnLoginChannel, loginMethod, region]);

  const clearFeedback = () => {
    setNotice("");
    setError("");
  };

  const msg = useCallback((raw: unknown) => {
    const m = raw instanceof Error ? raw.message : String(raw || "");
    const lower = m.toLowerCase();
    if (!m) return ui.operationFailed;
    if (lower.includes("already")) return ui.emailAlreadyRegistered;
    if (lower.includes("invalid email")) return ui.invalidEmailFormat;
    if (lower.includes("weak password") || lower.includes("security requirements")) return ui.weakPassword;
    if (lower.includes("google")) return t.auth.googleLoginFailed;
    return m;
  }, [t.auth.googleLoginFailed, ui.emailAlreadyRegistered, ui.invalidEmailFormat, ui.operationFailed, ui.weakPassword]);

  const requirePrivacy = () => {
    if (region === RegionType.CHINA && !agreeToPrivacy) {
      setError(ui.privacyConsentRequired);
      return false;
    }
    return true;
  };

  const resetForgot = () => {
    setForgotStep("off");
    setResetOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmNewPassword("");
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

    router.replace(postAuthUrl);
  }, [postAuthUrl, region, router]);

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

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !requirePrivacy()) return;
    if (region === RegionType.CHINA && cnLoginChannel === "phone") {
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
        const { error: err } = await authClient.signInWithPassword({ email, password });
        if (err) throw err;
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
            emailRedirectTo: `${window.location.origin}${buildUrl("/auth/callback", { redirect: postAuthPath })}`,
          },
        });
        if (err) throw err;
        setNotice(ui.registerSuccessIntl);
      }
      setPassword("");
      setConfirmPassword("");
      setAgreeToPrivacy(false);
      window.setTimeout(() => router.push(buildUrl("/auth", { mode: "signin" })), region === RegionType.CHINA ? 1200 : 3000);
    } catch (err) {
      setError(msg(err));
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (loading) return;
    clearFeedback();
    setLoading(true);
    try {
      const { error: err } = await authClient.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}${buildUrl("/auth/callback", { redirect: postAuthPath })}` },
      });
      if (err) throw err;
    } catch (err) {
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
          options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${buildUrl("/auth", { mode: "signin" })}` },
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
    ? loginMethod === "password"
      ? t.auth.loggingIn
      : otpSent
        ? t.auth.verifying
        : t.auth.sending
    : loginMethod === "password"
      ? t.auth.signInButton
      : otpSent
        ? t.auth.verifyOtp
        : t.auth.sendOtp;
  const showForgotPassword =
    loginMethod === "password" &&
    (region !== RegionType.CHINA || cnLoginChannel === "email");

  const privacy = (
    <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
      <Checkbox id={`privacy-${mode}`} checked={agreeToPrivacy} onCheckedChange={(checked) => setAgreeToPrivacy(Boolean(checked))} className="mt-1" />
      <label htmlFor={`privacy-${mode}`} className="flex-1 cursor-pointer text-sm text-gray-700">
        {ui.consentPrefix}{" "}
        <button type="button" className="text-blue-600 hover:underline" onClick={() => router.push(buildUrl("/privacy"))}>{ui.privacyPolicy}</button>{" "}
        {ui.consentConnector}{" "}
        <button type="button" className="text-blue-600 hover:underline" onClick={() => router.push(buildUrl("/terms"))}>{ui.termsOfService}</button>
        {region === RegionType.CHINA ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
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
    forgotStep !== "off" ? forgotForm : (
      <form onSubmit={loginMethod === "password" ? onSignIn : onOtp} className="space-y-4">
        {region === RegionType.CHINA ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {cnLoginChannel === "email"
              ? "当前为邮箱+密码登录，可通过下方文字切换到手机号登录。"
              : loginMethod === "otp"
                ? (otpSent
                    ? "当前为手机号验证码验证，请输入验证码完成登录。"
                    : "当前为手机号验证码登录。")
                : "当前为手机号+密码登录，可通过下方文字切换到验证码登录。"}
          </div>
        ) : null}

        {region === RegionType.CHINA && cnLoginChannel === "phone" && !otpMethodAvailable && !configLoading ? (
          <Alert>
            <AlertDescription>
              SMS OTP sign-in is temporarily unavailable: {smsAvailability?.reason || "SMS service is not fully configured."}
            </AlertDescription>
          </Alert>
        ) : null}

        {loginMethod === "password" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="signin-identifier">{loginIdentifierLabel}</Label>
              <Input
                id="signin-identifier"
                type={loginIdentifierType}
                placeholder={loginIdentifierPlaceholder}
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
              {supportsOtp ? (
                <div className="flex justify-between text-sm">
                  {region === RegionType.CHINA ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => {
                          clearFeedback();
                          setCnLoginChannel(cnLoginChannel === "email" ? "phone" : "email");
                          setLoginMethod("password");
                          setOtp("");
                          setOtpSent(false);
                        }}
                      >
                        {cnLoginChannel === "email" ? "切换到手机号登录" : "切换到邮箱登录"}
                      </button>

                      {cnLoginChannel === "phone" ? (
                        <button
                          type="button"
                          disabled={!otpMethodAvailable}
                          className={`text-blue-600 hover:underline ${!otpMethodAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                          onClick={() => {
                            if (!otpMethodAvailable) return;
                            clearFeedback();
                            setLoginMethod("otp");
                            setOtp("");
                            setOtpSent(false);
                          }}
                        >
                          {loginMethodOtpLabel}
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!otpMethodAvailable}
                      className={`text-blue-600 hover:underline ${!otpMethodAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                      onClick={() => {
                        if (!otpMethodAvailable) return;
                        clearFeedback();
                        setLoginMethod("otp");
                        setOtp("");
                        setOtpSent(false);
                      }}
                    >
                      {loginMethodOtpLabel}
                    </button>
                  )}
                  {showForgotPassword ? (
                    <button type="button" className="text-blue-600 hover:underline" onClick={() => { clearFeedback(); setForgotStep("request"); }}>{t.auth.forgotPassword}</button>
                  ) : null}
                </div>
              ) : null}
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
            <div className="flex justify-between text-sm">
              {otpSent ? (
                <button
                  type="button"
                  className="text-blue-600 hover:underline"
                  onClick={() => {
                    clearFeedback();
                    setOtp("");
                    setOtpSent(false);
                  }}
                >
                  {t.auth.backToModify}
                </button>
              ) : <span />}
              {region === RegionType.CHINA ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-right">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      clearFeedback();
                      setCnLoginChannel("phone");
                      setLoginMethod("password");
                      setOtp("");
                      setOtpSent(false);
                    }}
                  >
                    改用手机号+密码登录
                  </button>
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      clearFeedback();
                      setCnLoginChannel("email");
                      setLoginMethod("password");
                      setOtp("");
                      setOtpSent(false);
                    }}
                  >
                    切换到邮箱登录
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        )}
        {privacy}
        <Button type="submit" className="w-full" disabled={loading}>{signInButton}</Button>
      </form>
    );
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-6 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full max-w-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => router.push(buildUrl("/"))}><Home className="mr-1.5 h-4 w-4" /><span className="truncate">{t.auth.backToHome}</span></Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => router.push(buildUrl("/privacy"))}>{ui.privacyPolicy}</Button>
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" onClick={() => { clearFeedback(); resetForgot(); setLoginMethod("password"); setCnLoginChannel("email"); router.push(buildUrl("/auth", { mode: "signin" })); }}>{t.auth.login}</TabsTrigger>
                <TabsTrigger value="signup" onClick={() => { clearFeedback(); resetForgot(); router.push(buildUrl("/auth", { mode: "signup" })); }}>{t.auth.register}</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-6">
                {signInFormEnhanced}
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
                  {privacy}
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
            {region !== RegionType.CHINA && thirdPartyUnavailable && !configLoading ? <Alert className="mt-4"><AlertDescription>{ui.oauthUnavailable}</AlertDescription></Alert> : null}
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


