"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import {
  clearAuthState,
  getStoredAuthState,
  initAuthStateManager,
  initializeTokenPreloader,
} from "@/lib/auth/auth-state-manager";
import { getAuthClient } from "@/lib/auth/client";
import type { UserPreferences } from "@/lib/account/profile";
import { resolveUserRole } from "@/lib/auth/user-role";
import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: string;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_expires_at?: string;
  membership_expires_at?: string;
  preferences?: UserPreferences;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  isAuthInitialized: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const authClient = getAuthClient();
const BYPASS_AUTH_FOR_PREVIEW = false;

const PREVIEW_USER: UserProfile = {
  id: "preview-user",
  email: "preview@morncontract.local",
  name: "MornContract Preview",
  role: "admin",
  subscription_plan: "pro",
  subscription_status: "active",
};

const UserContext = createContext<UserContextType | undefined>(undefined);

function mapSupabaseSessionUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
}): UserProfile {
  return {
    id: sessionUser.id,
    email: sessionUser.email || "",
    name:
      sessionUser.user_metadata?.displayName ||
      sessionUser.user_metadata?.full_name ||
      "",
    avatar:
      sessionUser.user_metadata?.avatar ||
      sessionUser.user_metadata?.avatar_url ||
      "",
    role: resolveUserRole(sessionUser),
    preferences: sessionUser.user_metadata?.preferences,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);

  const signOut = useCallback(async () => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      setUser(PREVIEW_USER);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { error } = await authClient.signOut();
      if (error) {
        console.error("[UserContext] Sign-out failed:", error);
      }
      clearAuthState();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      setUser(PREVIEW_USER);
      return;
    }

    try {
      console.log("[UserContext] Refreshing user profile");
      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();

      if (!headers) {
        console.warn("[UserContext] Missing auth header, skipped refresh");
        return;
      }

      const response = await fetch("/api/profile", { headers });
      if (!response.ok) {
        throw new Error(`Failed to refresh profile: ${response.status}`);
      }

      const updatedUser = (await response.json()) as UserProfile;
      setUser(updatedUser);

      if (!isChinaRegion()) {
        try {
          const { saveSupabaseUserCache } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          saveSupabaseUserCache(updatedUser);
          console.log("[UserContext] Synced refreshed user into Supabase cache");
        } catch (cacheError) {
          console.warn("[UserContext] Failed to update Supabase cache:", cacheError);
        }
      }
    } catch (error) {
      console.error("[UserContext] Failed to refresh user profile:", error);
    }
  }, []);

  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      setUser(PREVIEW_USER);
      setIsAuthInitialized(true);
      setLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        console.log("[UserContext] Initializing auth state");

        if (isChinaRegion()) {
          initAuthStateManager();
        }

        let authState: { user?: UserProfile | null } | null = null;

        if (isChinaRegion()) {
          authState = getStoredAuthState();
        } else {
          const { getSupabaseUserCache, syncSupabaseAuthCookie } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          const cachedUser = getSupabaseUserCache();

          if (cachedUser) {
            console.log("[UserContext] Restored user from Supabase cache");
            syncSupabaseAuthCookie(undefined, cachedUser.role || "user");
            authState = { user: cachedUser as UserProfile };
          } else {
            console.log("[UserContext] Cache miss, reading Supabase session");
            const { data, error } = await supabase.auth.getSession();

            if (error) {
              console.error("[UserContext] Failed to read Supabase session:", error);
            } else if (data?.session?.user) {
              const restoredUser = mapSupabaseSessionUser(data.session.user);
              const { saveSupabaseUserCache } = await import(
                "@/lib/auth/auth-state-manager-intl"
              );
              saveSupabaseUserCache(restoredUser);
              authState = { user: restoredUser };
            }
          }
        }

        if (authState?.user) {
          setUser(authState.user);
          console.log("[UserContext] User restored");
        } else {
          setUser(null);
          console.log("[UserContext] No active user found");
        }

        setIsAuthInitialized(true);
        setLoading(false);

        if (isChinaRegion()) {
          initializeTokenPreloader();
        }
      } catch (error) {
        console.error("[UserContext] Failed to initialize auth:", error);
        setUser(null);
        setIsAuthInitialized(true);
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (isChinaRegion()) {
        if (event.key !== "app-auth-state") {
          return;
        }

        console.log("[UserContext] Detected CN auth state change from another tab");
        if (!event.newValue) {
          setUser(null);
          return;
        }

        try {
          const authState = JSON.parse(event.newValue);
          setUser((authState.user as UserProfile) || null);
        } catch (error) {
          console.error("[UserContext] Failed to parse CN auth state:", error);
          setUser(null);
        }
        return;
      }

      if (event.key !== "supabase-user-cache") {
        return;
      }

      console.log("[UserContext] Detected INTL cache change from another tab");
      if (!event.newValue) {
        setUser(null);
        return;
      }

      try {
        const cache = JSON.parse(event.newValue);
        setUser((cache.user as UserProfile) || null);
      } catch (error) {
        console.error("[UserContext] Failed to parse INTL cache state:", error);
        setUser(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      return;
    }

    const handleAuthStateChanged = async () => {
      console.log("[UserContext] auth-state-changed event received");

      if (isChinaRegion()) {
        const authState = getStoredAuthState();
        setUser((authState?.user as UserProfile) || null);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("[UserContext] Failed to sync Supabase session:", error);
        const { clearSupabaseUserCache } = await import(
          "@/lib/auth/auth-state-manager-intl"
        );
        clearSupabaseUserCache();
        setUser(null);
        return;
      }

      if (data?.session?.user) {
        const syncedUser = mapSupabaseSessionUser(data.session.user);
        const { saveSupabaseUserCache } = await import(
          "@/lib/auth/auth-state-manager-intl"
        );
        saveSupabaseUserCache(syncedUser);
        setUser(syncedUser);
      } else {
        const { clearSupabaseUserCache } = await import(
          "@/lib/auth/auth-state-manager-intl"
        );
        clearSupabaseUserCache();
        setUser(null);
      }
    };

    const handleSupabaseUserChanged = (event: Event) => {
      const customEvent = event as CustomEvent<UserProfile | null>;
      console.log("[UserContext] supabase-user-changed event received");
      setUser(customEvent.detail || null);
    };

    window.addEventListener("auth-state-changed", handleAuthStateChanged);

    if (!isChinaRegion()) {
      window.addEventListener(
        "supabase-user-changed",
        handleSupabaseUserChanged as EventListener,
      );
    }

    return () => {
      window.removeEventListener("auth-state-changed", handleAuthStateChanged);
      if (!isChinaRegion()) {
        window.removeEventListener(
          "supabase-user-changed",
          handleSupabaseUserChanged as EventListener,
        );
      }
    };
  }, []);

  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW || isChinaRegion()) {
      return;
    }

    console.log("[UserContext] Listening to Supabase auth state changes");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log("[UserContext] Supabase auth event:", event);

        if (session?.user) {
          const syncedUser = mapSupabaseSessionUser(session.user);
          const { saveSupabaseUserCache } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          saveSupabaseUserCache(syncedUser);
          setUser(syncedUser);
          return;
        }

        const { clearSupabaseUserCache } = await import(
          "@/lib/auth/auth-state-manager-intl"
        );
        clearSupabaseUserCache();
        setUser(null);
      },
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      isAuthInitialized,
      signOut,
      refreshUser,
    }),
    [isAuthInitialized, loading, refreshUser, signOut, user],
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
