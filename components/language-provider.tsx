"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "@/lib/i18n";
import type { DeploymentRegion } from "@/lib/config/deployment.config";
import { currentRegion, getDefaultLanguage } from "@/lib/config/deployment.config";

interface LanguageContextType {
  language: Language;
  deploymentLanguage: Language;
  deploymentRegion: DeploymentRegion;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "preferred-language";
const DEFAULT_CN_HOSTS = ["morncontract.mornscience.top"];
const DEFAULT_INTL_HOSTS = ["www.mornhub.quest"];

function normalizeHostCandidate(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0] || null;
  }
}

function parseHosts(envValue: string | undefined, fallback: string[]): string[] {
  const fromEnv = (envValue || "")
    .split(",")
    .map((item) => normalizeHostCandidate(item))
    .filter((item): item is string => Boolean(item));

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return fallback
    .map((item) => normalizeHostCandidate(item))
    .filter((item): item is string => Boolean(item));
}

function hostMatches(hostname: string, candidates: string[]): boolean {
  return candidates.some(
    (candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`),
  );
}

function resolveLanguageFromHost(defaultLanguage: Language): Language {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  if (!hostname) {
    return defaultLanguage;
  }

  const cnHosts = parseHosts(
    process.env.NEXT_PUBLIC_DOMESTIC_HOSTS,
    DEFAULT_CN_HOSTS,
  );
  const intlHosts = parseHosts(
    process.env.NEXT_PUBLIC_INTL_HOSTS,
    DEFAULT_INTL_HOSTS,
  );

  if (hostMatches(hostname, cnHosts)) {
    return "zh";
  }

  if (hostMatches(hostname, intlHosts)) {
    return "en";
  }

  if (hostname.endsWith(".cn")) {
    return "zh";
  }

  if (hostname.includes("mornscience.top")) {
    return "zh";
  }

  if (hostname.includes("mornhub.quest")) {
    return "en";
  }

  return defaultLanguage;
}

interface LanguageProviderProps {
  children: ReactNode;
  initialLanguage?: Language;
  deploymentRegion?: DeploymentRegion;
}

export function LanguageProvider({
  children,
  initialLanguage = getDefaultLanguage(),
  deploymentRegion = currentRegion,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const runtimeLanguage = resolveLanguageFromHost(initialLanguage);
    setMounted(true);
    localStorage.setItem(STORAGE_KEY, runtimeLanguage);
    document.documentElement.lang = runtimeLanguage;
    setLanguageState(runtimeLanguage);
  }, [initialLanguage]);

  const setLanguage = (lang: Language) => {
    const runtimeLanguage = resolveLanguageFromHost(initialLanguage);

    if (lang !== runtimeLanguage) {
      console.info(
        `[LanguageProvider] Language is fixed by entry host. Keeping ${runtimeLanguage}.`,
      );
    }

    localStorage.setItem(STORAGE_KEY, runtimeLanguage);
    document.documentElement.lang = runtimeLanguage;
    setLanguageState(runtimeLanguage);
  };

  const toggleLanguage = () => {
    const runtimeLanguage = resolveLanguageFromHost(initialLanguage);
    setLanguage(runtimeLanguage);
  };

  if (!mounted) {
    return (
      <LanguageContext.Provider
        value={{
          language: initialLanguage,
          deploymentLanguage: initialLanguage,
          deploymentRegion,
          setLanguage: () => {},
          toggleLanguage: () => {},
        }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        deploymentLanguage: initialLanguage,
        deploymentRegion,
        setLanguage,
        toggleLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
