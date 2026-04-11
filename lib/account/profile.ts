import { getDefaultLanguage } from "@/lib/config/deployment.config";
import { normalizeAvatarSrc } from "@/lib/account/avatar";

export type AccountTheme = "light" | "dark" | "system";

export interface UserPreferences {
  language: "zh" | "en";
  theme: AccountTheme;
  notifications: boolean;
  emailUpdates: boolean;
  autoSaveDrafts: boolean;
  contractReminders: boolean;
  signatureReminders: boolean;
  billingEmails: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
  desktopAlerts: boolean;
  wechatAlerts: boolean;
  feishuAlerts: boolean;
}

export interface AccountSecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  trustedDevicesOnly: boolean;
  passkeyEnabled: boolean;
  sessionTimeoutMinutes: number;
  lastPasswordUpdatedAt?: string;
}

export interface AccountSessionRecord {
  id: string;
  device: string;
  location: string;
  ipAddress?: string;
  lastActiveAt: string;
  trusted: boolean;
  current: boolean;
  userAgent?: string;
}

export interface AccountProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  phone: string;
  role: string;
  subscription_plan: string;
  subscription_status: string;
  subscription_expires_at?: string;
  membership_expires_at?: string;
  preferences: UserPreferences;
  security: AccountSecuritySettings;
  sessions: AccountSessionRecord[];
  activeCompanyProfileId?: string;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  return fallback;
}

export function getDefaultUserPreferences(): UserPreferences {
  return {
    language: getDefaultLanguage(),
    theme: "system",
    notifications: true,
    emailUpdates: true,
    autoSaveDrafts: true,
    contractReminders: true,
    signatureReminders: true,
    billingEmails: true,
    marketingEmails: false,
    weeklyDigest: true,
    desktopAlerts: true,
    wechatAlerts: true,
    feishuAlerts: false,
  };
}

export function getDefaultAccountSecuritySettings(): AccountSecuritySettings {
  return {
    twoFactorEnabled: false,
    loginAlerts: true,
    trustedDevicesOnly: false,
    passkeyEnabled: false,
    sessionTimeoutMinutes: 120,
  };
}

export function normalizeAccountSecuritySettings(
  value?: Partial<AccountSecuritySettings> | null,
): AccountSecuritySettings {
  const defaults = getDefaultAccountSecuritySettings();

  return {
    twoFactorEnabled: toBoolean(value?.twoFactorEnabled, defaults.twoFactorEnabled),
    loginAlerts: toBoolean(value?.loginAlerts, defaults.loginAlerts),
    trustedDevicesOnly: toBoolean(
      value?.trustedDevicesOnly,
      defaults.trustedDevicesOnly,
    ),
    passkeyEnabled: toBoolean(value?.passkeyEnabled, defaults.passkeyEnabled),
    sessionTimeoutMinutes: toPositiveInteger(
      value?.sessionTimeoutMinutes,
      defaults.sessionTimeoutMinutes,
    ),
    lastPasswordUpdatedAt:
      typeof value?.lastPasswordUpdatedAt === "string"
        ? value.lastPasswordUpdatedAt
        : undefined,
  };
}

export function normalizeAccountSessionRecord(
  value?: Partial<AccountSessionRecord> | null,
): AccountSessionRecord {
  return {
    id:
      typeof value?.id === "string" && value.id.trim()
        ? value.id.trim()
        : `session-${Date.now()}`,
    device:
      typeof value?.device === "string" && value.device.trim()
        ? value.device.trim()
        : "Unknown Device",
    location:
      typeof value?.location === "string" && value.location.trim()
        ? value.location.trim()
        : "Unknown Location",
    ipAddress:
      typeof value?.ipAddress === "string" && value.ipAddress.trim()
        ? value.ipAddress.trim()
        : undefined,
    lastActiveAt:
      typeof value?.lastActiveAt === "string" && value.lastActiveAt.trim()
        ? value.lastActiveAt
        : new Date().toISOString(),
    trusted: toBoolean(value?.trusted, false),
    current: toBoolean(value?.current, false),
    userAgent:
      typeof value?.userAgent === "string" && value.userAgent.trim()
        ? value.userAgent.trim()
        : undefined,
  };
}

export function normalizeAccountSessions(
  value?: Array<Partial<AccountSessionRecord>> | null,
): AccountSessionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeAccountSessionRecord(item))
    .sort((left, right) =>
      new Date(right.lastActiveAt).getTime() - new Date(left.lastActiveAt).getTime(),
    );
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
    signatureReminders: toBoolean(
      value?.signatureReminders,
      defaults.signatureReminders,
    ),
    billingEmails: toBoolean(value?.billingEmails, defaults.billingEmails),
    marketingEmails: toBoolean(value?.marketingEmails, defaults.marketingEmails),
    weeklyDigest: toBoolean(value?.weeklyDigest, defaults.weeklyDigest),
    desktopAlerts: toBoolean(value?.desktopAlerts, defaults.desktopAlerts),
    wechatAlerts: toBoolean(value?.wechatAlerts, defaults.wechatAlerts),
    feishuAlerts: toBoolean(value?.feishuAlerts, defaults.feishuAlerts),
  };
}

export function normalizeAccountProfile(
  value?: Partial<AccountProfile> | null,
): AccountProfile {
  const avatar = normalizeAvatarSrc(value?.avatar);

  return {
    id: value?.id || "",
    email: value?.email || "",
    name: value?.name || "",
    avatar: avatar || "",
    phone: value?.phone || "",
    role: value?.role || "user",
    subscription_plan: value?.subscription_plan || "free",
    subscription_status: value?.subscription_status || "inactive",
    subscription_expires_at: value?.subscription_expires_at,
    membership_expires_at: value?.membership_expires_at,
    preferences: normalizeUserPreferences(value?.preferences),
    security: normalizeAccountSecuritySettings(value?.security),
    sessions: normalizeAccountSessions(value?.sessions),
    activeCompanyProfileId:
      typeof value?.activeCompanyProfileId === "string"
        ? value.activeCompanyProfileId
        : undefined,
  };
}
