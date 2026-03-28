import { getDefaultLanguage } from "@/lib/config/deployment.config";

export type AccountTheme = "light" | "dark" | "system";

export interface UserPreferences {
  language: "zh" | "en";
  theme: AccountTheme;
  notifications: boolean;
  emailUpdates: boolean;
  autoSaveDrafts: boolean;
  contractReminders: boolean;
}

export interface AccountProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  phone: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at?: string;
  membership_expires_at?: string;
  preferences: UserPreferences;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function getDefaultUserPreferences(): UserPreferences {
  return {
    language: getDefaultLanguage(),
    theme: "system",
    notifications: true,
    emailUpdates: true,
    autoSaveDrafts: true,
    contractReminders: true,
  };
}

export function normalizeUserPreferences(
  value?: Partial<UserPreferences> | null,
): UserPreferences {
  const defaults = getDefaultUserPreferences();
  const theme =
    value?.theme === "light" || value?.theme === "dark" || value?.theme === "system"
      ? value.theme
      : defaults.theme;

  return {
    language: defaults.language,
    theme,
    notifications: toBoolean(value?.notifications, defaults.notifications),
    emailUpdates: toBoolean(value?.emailUpdates, defaults.emailUpdates),
    autoSaveDrafts: toBoolean(value?.autoSaveDrafts, defaults.autoSaveDrafts),
    contractReminders: toBoolean(
      value?.contractReminders,
      defaults.contractReminders,
    ),
  };
}

export function normalizeAccountProfile(
  value?: Partial<AccountProfile> | null,
): AccountProfile {
  return {
    id: value?.id || "",
    email: value?.email || "",
    name: value?.name || "",
    avatar: value?.avatar || "",
    phone: value?.phone || "",
    subscription_plan: value?.subscription_plan || "free",
    subscription_status: value?.subscription_status || "inactive",
    subscription_expires_at: value?.subscription_expires_at,
    membership_expires_at: value?.membership_expires_at,
    preferences: normalizeUserPreferences(value?.preferences),
  };
}
