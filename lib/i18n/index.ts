/**
 * 极简 i18n 系统
 * Minimal i18n System
 */

import { zh } from "./translations/zh";
import { en } from "./translations/en";

// 导出翻译对象
export const translations = {
  zh,
  en,
} as const;

// 导出类型
export type Language = "zh" | "en";
export type Translations = typeof zh;

/**
 * 获取翻译对象（用于组件中）
 * @param language - 语言代码
 * @returns 翻译对象
 */
export function useTranslations(language: Language): Translations {
  return translations[language] || translations.zh;
}

/**
 * 获取翻译对象（别名）
 * @param language - 语言代码
 * @returns 翻译对象
 */
export function getTranslations(language: Language): Translations {
  return translations[language] || translations.zh;
}
