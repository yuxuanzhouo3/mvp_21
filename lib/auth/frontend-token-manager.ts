import {
  clearAuthState,
  getStoredAuthState,
  getValidAccessToken,
} from "@/lib/auth/auth-state-manager";
import { clearSupabaseUserCache } from "@/lib/auth/auth-state-manager-intl";
import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";

class TokenManager {
  private static instance: TokenManager;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshInFlight: Promise<string | null> | null = null;
  private lastIntlRefreshAt = 0;
  private visibilityHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private storageHandler: ((event: StorageEvent) => void) | null = null;
  private authSubscription: { unsubscribe: () => void } | null = null;

  private constructor() {
    this.setupAutoRefresh();
    this.setupIntlSessionResilience();
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
      }

      const session = data?.session || this.getSupabaseStoredSession();
      const token = session?.access_token || null;
      const expiresAtMs = typeof session?.expires_at === "number"
        ? session.expires_at * 1000
        : null;

      // Prefer local session state; avoid hard-failing on transient network issues.
      if (token && (!expiresAtMs || Date.now() < expiresAtMs - 30_000)) {
        return token;
      }

      const refreshedToken = await this.tryRefreshSupabaseToken();
      if (refreshedToken) {
        return refreshedToken;
      }

      // If refresh failed but we still have a token that is not strictly expired, keep using it.
      if (token && (!expiresAtMs || Date.now() < expiresAtMs)) {
        return token;
      }

      console.warn("[TokenManager] No recoverable Supabase token available");
      this.clearIntlAuthState();
      return null;
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
        void supabase.auth.signOut().catch(() => {
          // Ignore sign-out transport errors; local cleanup already happened.
        });
        clearSupabaseUserCache();
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

    if (this.visibilityHandler && typeof window !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.focusHandler && typeof window !== "undefined") {
      window.removeEventListener("focus", this.focusHandler);
      this.focusHandler = null;
    }

    if (this.onlineHandler && typeof window !== "undefined") {
      window.removeEventListener("online", this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.storageHandler && typeof window !== "undefined") {
      window.removeEventListener("storage", this.storageHandler);
      this.storageHandler = null;
    }

    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
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

          if (!isChinaRegion()) {
            // Proactively refresh before expiry to survive tab switches/backgrounding.
            void this.tryRefreshSupabaseToken();
          }
        }

        if (remainingTime <= 0 && this.isTokenValid() === false) {
          if (!isChinaRegion()) {
            void this.tryRefreshSupabaseToken().then((token) => {
              if (token) {
                window.dispatchEvent(new CustomEvent("token-refreshed"));
                return;
              }

              this.clearToken();
              window.dispatchEvent(new CustomEvent("token-expired"));
            });
            return;
          }

          this.clearToken();
          window.dispatchEvent(new CustomEvent("token-expired"));
        }
      } catch {
        // Ignore timer errors to avoid breaking the app shell.
      }
    }, 30000);
  }

  private async tryRefreshSupabaseToken(): Promise<string | null> {
    if (isChinaRegion()) {
      return null;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const now = Date.now();
    // Throttle refresh bursts triggered by focus/visibility/timer at the same time.
    if (now - this.lastIntlRefreshAt < 3000) {
      const session = this.getSupabaseStoredSession();
      return session?.access_token || null;
    }
    this.lastIntlRefreshAt = now;

    this.refreshInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn("[TokenManager] Failed to refresh Supabase session:", error);
        return null;
      }

      const refreshedToken = data?.session?.access_token;
      if (!refreshedToken) {
        return null;
      }

      return refreshedToken;
    } catch (error) {
      console.warn("[TokenManager] Supabase session refresh threw:", error);
      return null;
    } finally {
      this.refreshInFlight = null;
    }
    })();

    return this.refreshInFlight;
  }

  private setupIntlSessionResilience(): void {
    if (typeof window === "undefined" || isChinaRegion()) {
      return;
    }

    this.visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        void this.tryRefreshSupabaseToken();
      }
    };

    this.focusHandler = () => {
      void this.tryRefreshSupabaseToken();
    };

    this.onlineHandler = () => {
      void this.tryRefreshSupabaseToken();
    };

    this.storageHandler = (event: StorageEvent) => {
      const authKey = this.getSupabaseStorageKey();
      if (!authKey || event.key !== authKey) {
        return;
      }

      // Keep tabs aligned when session state changes elsewhere.
      if (!event.newValue) {
        this.clearIntlAuthState();
      }
    };

    document.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("focus", this.focusHandler);
    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("storage", this.storageHandler);

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          this.clearIntlAuthState();
          window.dispatchEvent(new CustomEvent("token-expired"));
          return;
        }

        if (session?.access_token) {
          window.dispatchEvent(new CustomEvent("token-refreshed"));
        }
      });
      this.authSubscription = subscription;
    } catch (error) {
      console.warn("[TokenManager] Failed to setup auth state bridge:", error);
    }
  }

  private clearIntlAuthState() {
    try {
      const authKey = this.getSupabaseStorageKey();
      if (authKey && typeof window !== "undefined") {
        localStorage.removeItem(authKey);
      }
      clearSupabaseUserCache();
    } catch (error) {
      console.warn("[TokenManager] Failed to clear intl auth state:", error);
    }
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
