/**
 * Auth State Manager
 * Unified client-side auth state for CN (CloudBase) and INTL (Supabase).
 */

import { initializeAuthTokenPreloader } from "@/lib/auth/auth-token-preloader";
import { isChinaRegion } from "@/lib/config/region";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
  subscription_plan?: string;
  [key: string]: any;
}

export interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tokenMeta: {
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
  };
  savedAt: number;
}

type RefreshResponseData = {
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  tokenMeta?: {
    accessTokenExpiresIn?: number;
    refreshTokenExpiresIn?: number;
  };
};

const AUTH_STATE_KEY = "app-auth-state";
let refreshInFlightPromise: Promise<string | null> | null = null;

function clearIntlAuthArtifacts(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem("supabase-user-cache");

    const keysToDelete: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && /^sb-.*-auth-token$/i.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("⚠️ [Auth] Failed to clear INTL auth artifacts:", error);
  }
}

function syncAuthCookies(maxAge: number, role?: string): void {
  document.cookie = `auth-logged-in=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `auth-role=${role || "user"}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearAuthCookies(): void {
  document.cookie = "auth-logged-in=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "auth-role=; path=/; max-age=0; SameSite=Lax";
}

function getRefreshTokenRemainingSeconds(authState: StoredAuthState): number {
  const refreshTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.refreshTokenExpiresIn * 1000;
  return Math.floor((refreshTokenExpiresAt - Date.now()) / 1000);
}

function writeStoredAuthState(nextState: StoredAuthState): void {
  localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(nextState));
  syncAuthCookies(
    nextState.tokenMeta.refreshTokenExpiresIn || 7 * 24 * 3600,
    nextState.user?.role,
  );
  window.dispatchEvent(new CustomEvent("auth-state-changed"));
}

async function getValidIntlAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/integrations/supabase");
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn("⚠️ [Auth] Failed to read INTL session:", error);
    }

    const expiresAtMs =
      typeof session?.expires_at === "number" ? session.expires_at * 1000 : null;

    if (
      session?.access_token &&
      (!expiresAtMs || Date.now() <= expiresAtMs - 30000)
    ) {
      return session.access_token;
    }

    const {
      data: refreshedData,
      error: refreshError,
    } = await supabase.auth.refreshSession();

    if (refreshError) {
      console.warn("⚠️ [Auth] Failed to refresh INTL session:", refreshError);
      return session?.access_token || null;
    }

    const refreshedSession = refreshedData?.session;
    if (!refreshedSession?.access_token) {
      return null;
    }

    try {
      const { syncSupabaseAuthCookie } = await import(
        "@/lib/auth/auth-state-manager-intl"
      );
      syncSupabaseAuthCookie(refreshedSession.expires_in || 3600);
    } catch {
      // Ignore cache sync failures.
    }

    return refreshedSession.access_token;
  } catch (error) {
    console.warn("⚠️ [Auth] INTL access token flow failed:", error);
    return null;
  }
}

export function syncAuthCookiesFromStoredState(
  authState: StoredAuthState | null,
): boolean {
  if (typeof window === "undefined") return false;

  if (!authState?.user?.id || !authState.tokenMeta?.refreshTokenExpiresIn) {
    clearAuthCookies();
    return false;
  }

  const remainingSeconds = getRefreshTokenRemainingSeconds(authState);
  if (remainingSeconds <= 0) {
    clearAuthCookies();
    return false;
  }

  syncAuthCookies(Math.max(remainingSeconds, 60), authState.user.role);
  return true;
}

export function initAuthStateManager(): void {
  if (typeof window === "undefined") return;

  try {
    const oldKeys = ["auth-token", "auth-user", "auth-logged-in"];
    const hasP0State = !!localStorage.getItem(AUTH_STATE_KEY);

    if (hasP0State) {
      oldKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn("⚠️ [Auth] Failed to cleanup legacy localStorage keys:", error);
  }
}

export function saveAuthState(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
  tokenMeta: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number },
): void {
  if (typeof window === "undefined") return;

  try {
    clearIntlAuthArtifacts();

    const authState: StoredAuthState = {
      accessToken,
      refreshToken,
      user,
      tokenMeta,
      savedAt: Date.now(),
    };

    writeStoredAuthState(authState);
  } catch (error) {
    console.error("❌ [Auth] Failed to save auth state:", error);
    localStorage.removeItem(AUTH_STATE_KEY);
  }
}

export function getStoredAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(AUTH_STATE_KEY);
    if (!stored) return null;

    const authState: StoredAuthState = JSON.parse(stored);

    if (
      !authState.accessToken ||
      !authState.refreshToken ||
      !authState.user?.id ||
      !authState.tokenMeta
    ) {
      console.warn("⚠️ [Auth] Stored auth state is incomplete");
      clearAuthState();
      return null;
    }

    if (!syncAuthCookiesFromStoredState(authState)) {
      console.warn("⚠️ [Auth] Local auth state expired or cookie sync lost");
      clearAuthState();
      return null;
    }

    return authState;
  } catch (error) {
    console.error("❌ [Auth] Failed to parse auth state:", error);
    clearAuthState();
    return null;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  if (!isChinaRegion()) {
    return getValidIntlAccessToken();
  }

  const authState = getStoredAuthState();
  if (!authState) return null;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  if (Date.now() <= accessTokenExpiresAt - 60000) {
    return authState.accessToken;
  }

  if (!isRefreshTokenValid()) {
    clearAuthState();
    return null;
  }

  if (refreshInFlightPromise) {
    return refreshInFlightPromise;
  }

  refreshInFlightPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshToken: authState.refreshToken,
        }),
      });

      if (!response.ok) {
        console.error(
          "❌ [Auth] 刷新失败，状态码:",
          response.status,
          response.statusText,
        );
        if (response.status === 401) {
          clearAuthState();
        }
        return null;
      }

      const data = (await response.json()) as RefreshResponseData;
      if (!data.accessToken) {
        console.error("❌ [Auth] Refresh response missing accessToken");
        return null;
      }

      const nextState: StoredAuthState = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || authState.refreshToken,
        user: data.user || authState.user,
        tokenMeta: {
          accessTokenExpiresIn:
            data.tokenMeta?.accessTokenExpiresIn ||
            authState.tokenMeta.accessTokenExpiresIn,
          refreshTokenExpiresIn:
            data.tokenMeta?.refreshTokenExpiresIn ||
            authState.tokenMeta.refreshTokenExpiresIn,
        },
        savedAt: Date.now(),
      };

      writeStoredAuthState(nextState);
      return nextState.accessToken;
    } catch (error) {
      console.error("❌ [Auth] Failed to refresh token:", error);
      return null;
    } finally {
      refreshInFlightPromise = null;
    }
  })();

  return refreshInFlightPromise;
}

export function getRefreshToken(): string | null {
  const authState = getStoredAuthState();
  return authState?.refreshToken || null;
}

export function getUser(): AuthUser | null {
  const authState = getStoredAuthState();
  return authState?.user || null;
}

export function isRefreshTokenValid(): boolean {
  const authState = getStoredAuthState();
  if (!authState) return false;

  const refreshTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.refreshTokenExpiresIn * 1000;

  return Date.now() < refreshTokenExpiresAt;
}

export function updateAccessToken(
  newAccessToken: string,
  newExpiresIn?: number,
): void {
  if (typeof window === "undefined") return;

  try {
    const authState = getStoredAuthState();
    if (!authState) {
      console.warn("⚠️ [Auth] Cannot update token without existing auth state");
      return;
    }

    authState.accessToken = newAccessToken;
    if (newExpiresIn) {
      authState.tokenMeta.accessTokenExpiresIn = newExpiresIn;
    }
    authState.savedAt = Date.now();

    writeStoredAuthState(authState);
  } catch (error) {
    console.error("❌ [Auth] Failed to update access token:", error);
  }
}

export function getAuthHeader(): { Authorization: string } | null {
  const authState = getStoredAuthState();
  if (!authState) return null;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  if (Date.now() > accessTokenExpiresAt - 60000) {
    return null;
  }

  return { Authorization: `Bearer ${authState.accessToken}` };
}

export async function getAuthHeaderAsync(): Promise<{
  Authorization: string;
} | null> {
  const token = await getValidAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export function clearAuthState(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(AUTH_STATE_KEY);
    clearAuthCookies();
    window.dispatchEvent(new CustomEvent("auth-state-changed"));
  } catch (error) {
    console.error("❌ [Auth] Failed to clear auth state:", error);
  }
}

export function isAuthenticated(): boolean {
  const authState = getStoredAuthState();
  if (!authState || !authState.user?.id) return false;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  return Date.now() < accessTokenExpiresAt - 60000;
}

export function initializeTokenPreloader() {
  if (typeof window === "undefined") return;

  try {
    initializeAuthTokenPreloader({
      preloadThreshold: 300,
      checkInterval: 30000,
      enableDetailedLogs: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    console.error("❌ [Auth] Failed to initialize token preloader:", error);
  }
}
