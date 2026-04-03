"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Language } from "@/lib/i18n";
import { getDefaultLanguage } from "@/lib/config/deployment.config";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "preferred-language";
const DEPLOYMENT_LANGUAGE: Language = getDefaultLanguage();

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEPLOYMENT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    localStorage.setItem(STORAGE_KEY, DEPLOYMENT_LANGUAGE);
    document.documentElement.lang = DEPLOYMENT_LANGUAGE;
    setLanguageState(DEPLOYMENT_LANGUAGE);
  }, []);

  const setLanguage = (lang: Language) => {
    if (lang !== DEPLOYMENT_LANGUAGE) {
      console.info(
        `[LanguageProvider] Language is fixed by APP_REGION. Keeping ${DEPLOYMENT_LANGUAGE}.`,
      );
    }

    localStorage.setItem(STORAGE_KEY, DEPLOYMENT_LANGUAGE);
    document.documentElement.lang = DEPLOYMENT_LANGUAGE;
    setLanguageState(DEPLOYMENT_LANGUAGE);
  };

  const toggleLanguage = () => {
    setLanguage(DEPLOYMENT_LANGUAGE);
  };

  if (!mounted) {
    return (
      <LanguageContext.Provider
        value={{
          language: DEPLOYMENT_LANGUAGE,
          setLanguage: () => {},
          toggleLanguage: () => {},
        }}
      >
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
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
