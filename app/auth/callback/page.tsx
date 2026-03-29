"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveAuthState } from "@/lib/auth/auth-state-manager";
import {
  clearWechatState,
  extractWechatAuthResponse,
  getSavedWechatState,
  validateWechatState,
} from "@/lib/wechat/oauth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useTranslations } from "@/lib/i18n";

function AuthCallbackContent() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const t = useTranslations(language);
  const text = t.authCallbackPage;

  const requestedRedirect = searchParams.get("redirect");
  const normalizedRedirect = requestedRedirect?.split("?")[0] || "";
  const postAuthPath =
    normalizedRedirect &&
    normalizedRedirect.startsWith("/") &&
    !normalizedRedirect.startsWith("//")
      ? normalizedRedirect
      : "/dashboard";

  const buildUrl = (path: string) => {
    const debug = searchParams.get("debug");
    if (debug) {
      return `${path}?debug=${debug}`;
    }
    return path;
  };

  useEffect(() => {
    const handleWechatCallback = async (response: any) => {
      const savedState = getSavedWechatState();
      if (!validateWechatState(response.state, savedState)) {
        setError(text.wechatStateInvalid);
        setLoading(false);
        return;
      }

      clearWechatState();

      if (response.error) {
        setError(`${text.wechatAuthFailed}: ${response.error_description}`);
        setLoading(false);
        return;
      }

      if (!response.code) {
        setError(text.wechatCodeMissing);
        setLoading(false);
        return;
      }

      try {
        const loginResponse = await fetch("/api/auth/wechat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: response.code,
          }),
        });

        if (!loginResponse.ok) {
          const errorData = await loginResponse.json();
          setError(errorData.details || errorData.error || text.wechatLoginFailed);
          setLoading(false);
          return;
        }

        const loginData = await loginResponse.json();

        if (loginData.success && loginData.accessToken && loginData.refreshToken) {
          saveAuthState(
            loginData.accessToken,
            loginData.refreshToken,
            {
              id: loginData.user.id,
              email: loginData.user.email,
              name: loginData.user.name,
              avatar: loginData.user.avatar,
            },
            {
              accessTokenExpiresIn:
                loginData.tokenMeta?.accessTokenExpiresIn || 3600,
              refreshTokenExpiresIn:
                loginData.tokenMeta?.refreshTokenExpiresIn || 604800,
            },
          );
        }

        setTimeout(() => {
          router.replace(buildUrl(postAuthPath));
        }, 500);
      } catch (err) {
        console.error("WeChat login request failed:", err);
        setError(err instanceof Error ? err.message : text.wechatLoginFailed);
        setLoading(false);
      }
    };

    const handleSupabaseCallback = async () => {
      const { getAuthClient } = await import("@/lib/auth/client");
      const sessionResult = await getAuthClient().getSession();

      if (sessionResult.error) {
        setError(sessionResult.error.message);
        setLoading(false);
        return;
      }

      if (sessionResult.data.session) {
        router.replace(buildUrl(postAuthPath));
      } else {
        setError(text.authFailed);
        setLoading(false);
      }
    };

    const handleAuthCallback = async () => {
      try {
        const wechatResponse = extractWechatAuthResponse(
          new URLSearchParams(searchParams),
        );

        if (wechatResponse.code || wechatResponse.error) {
          await handleWechatCallback(wechatResponse);
        } else {
          await handleSupabaseCallback();
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : text.callbackError);
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [postAuthPath, router, searchParams, text]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-center text-gray-600">{text.processing}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{text.resultTitle}</CardTitle>
          <CardDescription className="text-center">
            {error ? text.resultDescription : text.resultSuccess}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertDescription>{text.successRedirecting}</AlertDescription>
            </Alert>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push(buildUrl("/auth"))}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              {text.backToLogin}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthCallbackPage() {
  const { language } = useLanguage();
  const t = useTranslations(language);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-center text-gray-600">{t.common.loading}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
