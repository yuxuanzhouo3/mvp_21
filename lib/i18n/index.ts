/**
 * Minimal i18n entrypoint shared by client components.
 */

import { translationOverrides } from "./overrides";
import { en } from "./translations/en";
import { zh } from "./translations/zh";

const baseTranslations = {
  zh,
  en,
} as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  base: T,
  override: U,
): T & U {
  const result: Record<string, unknown> = { ...base };

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key];

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
      continue;
    }

    result[key] = overrideValue;
  }

  return result as T & U;
}

export const translations = {
  zh: deepMerge(baseTranslations.zh, translationOverrides.zh),
  en: deepMerge(baseTranslations.en, translationOverrides.en),
} as const;

export type Language = "zh" | "en";
export type Locale = Language;
export type Translations = typeof translations.zh;

export function useTranslations(language: Language): Translations {
  return translations[language] || translations.zh;
}

export function getTranslations(language: Language): Translations {
  return translations[language] || translations.zh;
}
