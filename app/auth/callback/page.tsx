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
        const { getAuthClient } = await import("@/lib/auth/client");
        const sessionResult = await getAuthClient().getSession();

        if (sessionResult.error) {
          setError(sessionResult.error.message);
          setLoading(false);
          return;
        }

        if (sessionResult.data.session) {
          router.replace(buildUrl(postAuthPath));
          return;
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
  }, [buildUrl, postAuthPath, router, text]);

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
