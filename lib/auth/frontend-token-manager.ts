import {
  clearAuthState,
  getStoredAuthState,
  getValidAccessToken,
} from "@/lib/auth/auth-state-manager";
import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";

class TokenManager {
  private static instance: TokenManager;
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.setupAutoRefresh();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  saveToken(_token: string, _expiresIn = 3600000): void {
    console.warn(
      "[TokenManager] saveToken() is deprecated. Use saveAuthState() instead.",
    );
  }

  async getValidToken(): Promise<string | null> {
    try {
      if (typeof window === "undefined") {
        return null;
      }

      if (isChinaRegion()) {
        const token = await getValidAccessToken();
        if (!token) {
          console.warn("[TokenManager] No valid CloudBase token available");
          return null;
        }
        return token;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn("[TokenManager] Failed to read Supabase session:", error);
        return null;
      }

      const token = data?.session?.access_token;
      if (!token) {
        console.warn("[TokenManager] No valid Supabase token available");
        return null;
      }

      return token;
    } catch (error) {
      console.error("[TokenManager] Failed to get valid token:", error);
      return null;
    }
  }

  getTokenRemainingTime(): number {
    try {
      if (typeof window === "undefined") {
        return 0;
      }

      if (isChinaRegion()) {
        const authState = getStoredAuthState();
        if (!authState) {
          return 0;
        }

        const expiresAt =
          authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;
        return Math.max(0, expiresAt - Date.now());
      }

      const storedSession = this.getSupabaseStoredSession();
      if (!storedSession?.expires_at) {
        return 0;
      }

      return Math.max(0, storedSession.expires_at * 1000 - Date.now());
    } catch {
      return 0;
    }
  }

  async getAuthHeaderAsync(): Promise<Record<string, string> | null> {
    const token = await this.getValidToken();
    if (!token) {
      return null;
    }

    return { Authorization: `Bearer ${token}` };
  }

  getAuthHeader(): Record<string, string> | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      if (isChinaRegion()) {
        const authState = getStoredAuthState();
        if (!authState?.accessToken) {
          return null;
        }
        return { Authorization: `Bearer ${authState.accessToken}` };
      }

      const session = this.getSupabaseStoredSession();
      if (!session?.access_token) {
        return null;
      }

      return { Authorization: `Bearer ${session.access_token}` };
    } catch {
      return null;
    }
  }

  isTokenValid(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      if (isChinaRegion()) {
        const authState = getStoredAuthState();
        if (!authState) {
          return false;
        }

        const expiresAt =
          authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;
        return Date.now() < expiresAt;
      }

      const session = this.getSupabaseStoredSession();
      if (!session?.access_token) {
        return false;
      }

      if (!session.expires_at) {
        return true;
      }

      return Date.now() < session.expires_at * 1000;
    } catch {
      return false;
    }
  }

  clearToken(): void {
    try {
      if (typeof window === "undefined") {
        return;
      }

      if (isChinaRegion()) {
        clearAuthState();
      } else {
        const authKey = this.getSupabaseStorageKey();
        if (authKey) {
          localStorage.removeItem(authKey);
        }
      }

      console.log("[TokenManager] Cleared local token state");
    } catch (error) {
      console.error("[TokenManager] Failed to clear token:", error);
    }
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  getStoredAuthState() {
    try {
      if (typeof window === "undefined") {
        return null;
      }
      return getStoredAuthState();
    } catch {
      return null;
    }
  }

  private getSupabaseStorageKey() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return null;
    }

    const projectId = supabaseUrl.split("//")[1]?.split(".")[0];
    if (!projectId) {
      return null;
    }

    return `sb-${projectId}-auth-token`;
  }

  private getSupabaseStoredSession():
    | { access_token?: string; expires_at?: number }
    | null {
    const authKey = this.getSupabaseStorageKey();
    if (!authKey || typeof window === "undefined") {
      return null;
    }

    const stored = localStorage.getItem(authKey);
    if (!stored) {
      return null;
    }

    try {
      const authData = JSON.parse(stored);
      return authData?.session || null;
    } catch {
      return null;
    }
  }

  private setupAutoRefresh(): void {
    if (typeof window === "undefined") {
      return;
    }

    this.refreshTimer = setInterval(() => {
      try {
        const remainingTime = this.getTokenRemainingTime();

        if (remainingTime < 300000 && remainingTime > 0) {
          window.dispatchEvent(
            new CustomEvent("token-expiring-soon", {
              detail: { remainingTime },
            }),
          );
        }

        if (remainingTime <= 0 && this.isTokenValid() === false) {
          this.clearToken();
          window.dispatchEvent(new CustomEvent("token-expired"));
        }
      } catch {
        // Ignore timer errors to avoid breaking the app shell.
      }
    }, 30000);
  }
}

export const tokenManager = TokenManager.getInstance();

export function onTokenExpiringsSoon(
  callback: (remainingTime: number) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    if (event instanceof CustomEvent) {
      callback(event.detail.remainingTime);
    }
  };

  window.addEventListener("token-expiring-soon", handler);
  return () => window.removeEventListener("token-expiring-soon", handler);
}

export function onTokenExpired(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();
  window.addEventListener("token-expired", handler);
  return () => window.removeEventListener("token-expired", handler);
}
