/**
 * Supabase (international) user cache manager.
 * Only stores the minimum UI fields we actually need on the client.
 */

import type { UserPreferences } from "@/lib/account/profile";

export interface SupabaseUserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
  subscription_plan?: string;
  subscription_status?: string;
  membership_expires_at?: string;
  preferences?: UserPreferences;
}

export interface SupabaseUserCache {
  user: SupabaseUserProfile;
  cachedAt: number;
  expiresIn: number;
}

const SUPABASE_USER_CACHE_KEY = "supabase-user-cache";
const DEFAULT_CACHE_DURATION = 3600;

function clearCnAuthArtifacts() {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem("app-auth-state");
    localStorage.removeItem("auth-token");
    localStorage.removeItem("auth-user");
    localStorage.removeItem("auth-logged-in");

    const debugKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("DEBUG_")) {
        debugKeys.push(key);
      }
    }
    debugKeys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("[Supabase Cache] Failed to clear CN auth artifacts:", error);
  }
}

export function syncSupabaseAuthCookie(
  expiresIn: number = DEFAULT_CACHE_DURATION,
  role: string = "user",
): void {
  if (typeof document === "undefined") return;

  document.cookie = `auth-logged-in=1; path=/; max-age=${expiresIn}; SameSite=Lax`;
  document.cookie = `auth-role=${role}; path=/; max-age=${expiresIn}; SameSite=Lax`;
}

export function clearSupabaseAuthCookie(): void {
  if (typeof document === "undefined") return;

  document.cookie = "auth-logged-in=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "auth-role=; path=/; max-age=0; SameSite=Lax";
}

export function saveSupabaseUserCache(
  user: Partial<SupabaseUserProfile> & { id: string; email: string },
  expiresIn: number = DEFAULT_CACHE_DURATION,
): void {
  if (typeof window === "undefined") return;

  try {
    // INTL login should not reuse stale CN session artifacts when switching envs.
    clearCnAuthArtifacts();

    const sanitizedUser: SupabaseUserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
      membership_expires_at: user.membership_expires_at,
      preferences: user.preferences,
    };

    const cache: SupabaseUserCache = {
      user: sanitizedUser,
      cachedAt: Date.now(),
      expiresIn,
    };

    localStorage.setItem(SUPABASE_USER_CACHE_KEY, JSON.stringify(cache));
    syncSupabaseAuthCookie(expiresIn, sanitizedUser.role || "user");

    window.dispatchEvent(
      new CustomEvent("supabase-user-changed", {
        detail: sanitizedUser,
      }),
    );
  } catch (error) {
    console.error("[Supabase Cache] Failed to save user cache:", error);
    localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
    clearSupabaseAuthCookie();
  }
}

export function getSupabaseUserCache(): SupabaseUserProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cache: SupabaseUserCache = JSON.parse(cached);
    if (!cache.user?.id || !cache.user?.email) {
      clearSupabaseUserCache();
      return null;
    }

    const age = Date.now() - cache.cachedAt;
    if (age > cache.expiresIn * 1000) {
      clearSupabaseUserCache();
      return null;
    }

    return cache.user;
  } catch (error) {
    console.error("[Supabase Cache] Failed to read user cache:", error);
    clearSupabaseUserCache();
    return null;
  }
}

export function clearSupabaseUserCache(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
    clearSupabaseAuthCookie();

    window.dispatchEvent(
      new CustomEvent("supabase-user-changed", {
        detail: null,
      }),
    );
  } catch (error) {
    console.error("[Supabase Cache] Failed to clear user cache:", error);
  }
}

export function isSupabaseCacheValid(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) return false;

    const cache: SupabaseUserCache = JSON.parse(cached);
    return Date.now() - cache.cachedAt <= cache.expiresIn * 1000;
  } catch {
    return false;
  }
}

export function updateSupabaseUserCache(
  updates: Partial<SupabaseUserProfile>,
): void {
  if (typeof window === "undefined") return;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) {
      return;
    }

    const cache: SupabaseUserCache = JSON.parse(cached);
    cache.user = {
      ...cache.user,
      ...updates,
    };
    cache.cachedAt = Date.now();

    localStorage.setItem(SUPABASE_USER_CACHE_KEY, JSON.stringify(cache));
    syncSupabaseAuthCookie(cache.expiresIn, cache.user.role || "user");

    window.dispatchEvent(
      new CustomEvent("supabase-user-changed", {
        detail: cache.user,
      }),
    );
  } catch (error) {
    console.error("[Supabase Cache] Failed to update user cache:", error);
  }
}

export function getCacheRemainingTime(): number {
  if (typeof window === "undefined") return 0;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) return 0;

    const cache: SupabaseUserCache = JSON.parse(cached);
    const age = Date.now() - cache.cachedAt;
    const remaining = cache.expiresIn - Math.floor(age / 1000);

    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}
