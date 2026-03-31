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

export type Language = "zh" | "en";
export type Locale = Language;

type DeepWidenLiterals<T> =
  T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T extends readonly (infer U)[] ? DeepWidenLiterals<U>[]
  : T extends (...args: never[]) => unknown ? T
  : T extends object ? { [K in keyof T]: DeepWidenLiterals<T[K]> }
  : T;

export type Translations =
  DeepWidenLiterals<typeof zh> &
  DeepWidenLiterals<typeof en> &
  DeepWidenLiterals<typeof translationOverrides.zh> &
  DeepWidenLiterals<typeof translationOverrides.en>;

export const translations: Record<Language, Translations> = {
  zh: deepMerge(baseTranslations.zh, translationOverrides.zh) as unknown as Translations,
  en: deepMerge(baseTranslations.en, translationOverrides.en) as unknown as Translations,
};

export function useTranslations(language: Language): Translations {
  return translations[language] || translations.zh;
}

export function getTranslations(language: Language): Translations {
  return translations[language] || translations.zh;
}
