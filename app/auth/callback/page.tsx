"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  readOAuthCallbackError,
  readOAuthCallbackErrorFromSearch,
} from "@/lib/auth/oauth-callback";

function AuthCallbackContent() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, deploymentRegion } = useLanguage();
  const t = useTranslations(language);
  const text = t.authCallbackPage;
  const isIntlRegion = deploymentRegion === "INTL";

  const requestedRedirect = searchParams.get("redirect");
  const normalizedRedirect = requestedRedirect?.split("?")[0] || "";
  const postAuthPath =
    normalizedRedirect &&
    normalizedRedirect.startsWith("/") &&
    !normalizedRedirect.startsWith("//")
      ? normalizedRedirect
      : "/dashboard";

  const buildUrl = useCallback(
    (path: string) => {
      const debug = searchParams.get("debug");
      if (debug) {
        return `${path}?debug=${debug}`;
      }
      return path;
    },
    [searchParams],
  );

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const currentHash =
          typeof window !== "undefined" ? window.location.hash : "";
        const currentSearch =
          typeof window !== "undefined" ? window.location.search : "";

        const oauthError =
          typeof window !== "undefined"
            ? readOAuthCallbackError(currentHash) ||
              readOAuthCallbackErrorFromSearch(currentSearch)
            : undefined;

        if (oauthError) {
          setError(oauthError);
          setLoading(false);
          return;
        }

        // Compatibility path: Supabase may redirect to /#access_token=... when callback
        // URL allowlist is incomplete. We can still finalize login by setting session here.
        if (
          currentHash.includes("access_token=") &&
          currentHash.includes("refresh_token=")
        ) {
          const params = new URLSearchParams(currentHash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { supabase } = await import("@/lib/integrations/supabase");
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionError) {
              setError(setSessionError.message);
              setLoading(false);
              return;
            }
          }
        }

        if (isIntlRegion) {
          const { supabase } = await import("@/lib/integrations/supabase");
          const code =
            typeof window !== "undefined"
              ? new URLSearchParams(currentSearch).get("code")
              : null;

          if (code) {
            const {
              data: { session: existingSession },
              error: existingSessionError,
            } = await supabase.auth.getSession();

            if (existingSessionError) {
              setError(existingSessionError.message);
              setLoading(false);
              return;
            }

            if (!existingSession) {
              const { error: exchangeError } =
                await supabase.auth.exchangeCodeForSession(code);
              if (exchangeError) {
                const {
                  data: { session: retriedSession },
                  error: retrySessionError,
                } = await supabase.auth.getSession();

                if (retrySessionError || !retriedSession) {
                  setError(
                    retrySessionError?.message || exchangeError.message,
                  );
                  setLoading(false);
                  return;
                }
              }
            }
          }

          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) {
            setError(sessionError.message);
            setLoading(false);
            return;
          }

          if (session) {
            try {
              const { saveSupabaseUserCache, syncSupabaseAuthCookie } = await import(
                "@/lib/auth/auth-state-manager-intl"
              );
              const metadata = session.user.user_metadata || {};
              const profile = {
                id: session.user.id,
                email: session.user.email || "",
                name:
                  metadata.displayName ||
                  metadata.full_name ||
                  metadata.name ||
                  "",
                avatar: metadata.avatar || metadata.avatar_url || "",
                role: metadata.role || "user",
                subscription_plan: metadata.subscription_plan,
                subscription_status: metadata.subscription_status,
                membership_expires_at: metadata.membership_expires_at,
                preferences: metadata.preferences,
              };
              const expiresInSeconds =
                typeof session.expires_in === "number" && session.expires_in > 0
                  ? session.expires_in
                  : 3600;
              saveSupabaseUserCache(profile, expiresInSeconds);
              syncSupabaseAuthCookie(expiresInSeconds, profile.role || "user");
            } catch (cacheError) {
              console.warn("[AuthCallback] Failed to prime Supabase auth cache:", cacheError);
            }

            router.replace(buildUrl(postAuthPath), {
              scroll: isIntlRegion ? false : undefined,
            });
            return;
          }
        } else {
          const { getAuthClient } = await import("@/lib/auth/client");
          const sessionResult = await getAuthClient().getSession();

          if (sessionResult.error) {
            setError(sessionResult.error.message);
            setLoading(false);
            return;
          }

          if (sessionResult.data.session) {
            router.replace(buildUrl(postAuthPath), {
              scroll: isIntlRegion ? false : undefined,
            });
            return;
          }
        }

        setError(text.authFailed);
        setLoading(false);
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : text.callbackError);
        setLoading(false);
      }
    };

    void handleAuthCallback();
  }, [buildUrl, isIntlRegion, postAuthPath, router, text]);

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
              onClick={() =>
                router.push(buildUrl("/auth"), {
                  scroll: isIntlRegion ? false : undefined,
                })
              }
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

function AuthCallbackFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-center text-gray-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
