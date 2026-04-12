import { useEffect, useState } from "react";
import type { Language } from "@/lib/i18n";

export interface AuthConfig {
  region: "CN" | "INTL";
  defaultLanguage: Language;
  authProvider: "cloudbase" | "supabase";
  features: {
    emailAuth: boolean;
    phoneOtpAuth: boolean;
    wechatAuth: boolean;
    googleAuth: boolean;
    githubAuth: boolean;
  };
  availability?: {
    sms?: { enabled: boolean; reason?: string };
    wechat?: { enabled: boolean; reason?: string };
    google?: { enabled: boolean; reason?: string };
  };
  appUrl: string | undefined;
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
}

export function useAuthConfig() {
  const [config, setConfig] = useState<AuthConfig>({
    region: "CN",
    defaultLanguage: "zh",
    authProvider: "cloudbase",
    features: {
      emailAuth: true,
      phoneOtpAuth: true,
      wechatAuth: false,
      googleAuth: false,
      githubAuth: false,
    },
    appUrl: undefined,
    supabaseUrl: undefined,
    supabaseAnonKey: undefined,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/auth/config");

        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.statusText}`);
        }

        const data = await response.json();
        setConfig(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        console.error("Failed to fetch auth config:", errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading, error };
}
