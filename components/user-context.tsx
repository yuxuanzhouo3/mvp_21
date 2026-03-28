"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  getStoredAuthState,
  clearAuthState,
  initializeTokenPreloader,
  initAuthStateManager,
} from "@/lib/auth/auth-state-manager";
import { getAuthClient } from "@/lib/auth/client";
import type { UserPreferences } from "@/lib/account/profile";
import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";

const authClient = getAuthClient();
// 预览模式：临时提供登录态，避免前端页面跳转到登录页（生产/正常开发应保持 false）
const BYPASS_AUTH_FOR_PREVIEW = false;
const PREVIEW_USER: UserProfile = {
  id: "preview-user",
  email: "preview@contracthub.local",
  name: "Preview User",
  subscription_plan: "pro",
  subscription_status: "active",
};

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
    preferences: sessionUser.user_metadata?.preferences,
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
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

const UserContext = createContext<UserContextType | undefined>(undefined);

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
        console.error("❌ [Auth] 登出失败:", error);
      }
      clearAuthState();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      setUser(PREVIEW_USER);
      return;
    }

    try {
      console.log("🔄 [Auth] 刷新用户信息...");
      const { tokenManager } = await import("@/lib/auth/frontend-token-manager");
      const headers = await tokenManager.getAuthHeaderAsync();
      if (!headers) {
        console.warn("⚠️ [Auth] 无法获取认证信息");
        return;
      }

      const response = await fetch("/api/profile", { headers });
      if (!response.ok) {
        throw new Error(`刷新用户信息失败: ${response.status}`);
      }

      const updatedUser = await response.json();
      setUser(updatedUser as UserProfile);

      // ✅ 国际版：同时保存到缓存，确保其他标签页也能同步
      if (!isChinaRegion()) {
        try {
          const { saveSupabaseUserCache } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          saveSupabaseUserCache(updatedUser);
          console.log("✅ [Auth INTL] 用户信息已缓存");
        } catch (cacheError) {
          console.warn(
            "⚠️ [Auth INTL] 缓存保存失败，但用户信息已更新:",
            cacheError
          );
        }
      }

      console.log("✅ [Auth] 用户信息已刷新");
    } catch (error) {
      console.error("❌ [Auth] 刷新用户信息失败:", error);
    }
  }, []);

  // P0：同步初始化认证状态（从 localStorage 同步读取）
  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      setUser(PREVIEW_USER);
      setIsAuthInitialized(true);
      setLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        console.log("📝 [Auth] 同步初始化认证状态...");

        // 0. 初始化认证管理器（清除旧键，仅用于CN）
        if (isChinaRegion()) {
          initAuthStateManager();
        }

        // 1. 根据区域读取认证状态
        let authState = null;

        if (isChinaRegion()) {
          // CN：从 CloudBase 的 app-auth-state 读取
          authState = getStoredAuthState();
        } else {
          // ✅ INTL：优先从缓存读取,缓存miss再从Supabase读取
          console.log("🌍 [Auth] INTL 模式，检查缓存...");
          const { getSupabaseUserCache, syncSupabaseAuthCookie } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          const cachedUser = getSupabaseUserCache();

          if (cachedUser) {
            console.log(`📦 [Auth] 从缓存恢复用户: ${cachedUser.email}`);
            syncSupabaseAuthCookie();
            authState = { user: cachedUser };
          } else {
            // 缓存miss，从 Supabase 读取
            console.log("🔍 [Auth] 缓存未命中，从 Supabase 读取 session...");
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              console.error("❌ [Auth] Supabase getSession 失败:", error);
            } else if (data?.session?.user) {
              const restoredUser = mapSupabaseSessionUser(data.session.user);
              const { saveSupabaseUserCache } = await import(
                "@/lib/auth/auth-state-manager-intl"
              );
              console.log(
                `✅ [Auth] 从 Supabase 恢复用户: ${data.session.user.email}`
              );
              saveSupabaseUserCache(restoredUser);
              authState = {
                user: restoredUser,
              };
            }
          }
        }

        if (authState && authState.user) {
          // 2. 立即设置用户信息（同步操作）
          setUser(authState.user as UserProfile);
          console.log(`✅ [Auth] 恢复用户: ${authState.user.email}`);
        } else {
          setUser(null);
          console.log("❌ [Auth] 无有效认证状态");
        }

        // 3. 标记初始化完成（重要：阻止闪烁）
        setIsAuthInitialized(true);
        setLoading(false);

        // P2-2: 初始化 token 预加载器（仅用于 CN）
        if (isChinaRegion()) {
          initializeTokenPreloader();
        }
      } catch (error) {
        console.error("❌ [Auth] 初始化失败:", error);
        setUser(null);
        setIsAuthInitialized(true);
        setLoading(false);
      }
    };

    // 异步执行初始化
    initializeAuth();
  }, []);

  // P1：多标签页同步（监听 storage 事件）
  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (isChinaRegion()) {
        // 国内版：监听 app-auth-state
        if (event.key === "app-auth-state") {
          console.log("📡 [Auth CN] 检测到其他标签页的认证变化");
          if (!event.newValue) {
            setUser(null);
          } else {
            try {
              const authState = JSON.parse(event.newValue);
              if (authState.user) {
                setUser(authState.user as UserProfile);
              }
            } catch (error) {
              console.error("❌ [Auth CN] 解析跨标签页数据失败:", error);
              setUser(null);
            }
          }
        }
      } else {
        // ✅ 国际版：监听 supabase-user-cache
        if (event.key === "supabase-user-cache") {
          console.log("📡 [Auth INTL] 检测到其他标签页的用户信息变化");
          if (!event.newValue) {
            setUser(null);
          } else {
            try {
              const cache = JSON.parse(event.newValue);
              if (cache.user) {
                setUser(cache.user as UserProfile);
                console.log("✅ [Auth INTL] 从其他标签页同步用户信息");
              }
            } catch (error) {
              console.error("❌ [Auth INTL] 解析跨标签页数据失败:", error);
              setUser(null);
            }
          }
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // P1：自定义事件监听（同标签页内 auth 状态变化）
  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      return;
    }

    const handleAuthStateChanged = async () => {
      console.log("🔔 [Auth] 检测到认证状态变化");

      if (isChinaRegion()) {
        // CN：从 CloudBase 读取
        const authState = getStoredAuthState();
        if (authState?.user) {
          setUser(authState.user as UserProfile);
        } else {
          setUser(null);
        }
      } else {
        // INTL：从 Supabase 读取
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("❌ [Auth] Supabase getSession 失败:", error);
          const { clearSupabaseUserCache } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          clearSupabaseUserCache();
          setUser(null);
        } else if (data?.session?.user) {
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
      }
    };

    // ✅ 国际版：监听 supabase-user-changed 自定义事件（同标签页内）
    const handleSupabaseUserChanged = (event: CustomEvent) => {
      console.log("🔔 [Auth INTL] 检测到同标签页内用户信息变化");
      if (event.detail) {
        setUser(event.detail as UserProfile);
      } else {
        setUser(null);
      }
    };

    window.addEventListener("auth-state-changed", handleAuthStateChanged);

    if (!isChinaRegion()) {
      window.addEventListener(
        "supabase-user-changed",
        handleSupabaseUserChanged as EventListener
      );
    }

    return () => {
      window.removeEventListener("auth-state-changed", handleAuthStateChanged);
      if (!isChinaRegion()) {
        window.removeEventListener(
          "supabase-user-changed",
          handleSupabaseUserChanged as EventListener
        );
      }
    };
  }, []);

  // INTL：Supabase 认证状态变化监听器
  useEffect(() => {
    if (BYPASS_AUTH_FOR_PREVIEW) {
      return;
    }

    if (!isChinaRegion()) {
      console.log("🌍 [Auth] 设置 Supabase auth 状态变化监听器...");

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
        console.log(`🔔 [Auth] Supabase 认证事件: ${event}`);

        if (session?.user) {
          console.log(`✅ [Auth] Supabase 用户登录: ${session.user.email}`);
          const syncedUser = mapSupabaseSessionUser(session.user);
          const { saveSupabaseUserCache } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          saveSupabaseUserCache(syncedUser);
          setUser(syncedUser);
        } else {
          console.log("❌ [Auth] Supabase 用户登出");
          const { clearSupabaseUserCache } = await import(
            "@/lib/auth/auth-state-manager-intl"
          );
          clearSupabaseUserCache();
          setUser(null);
        }
      });

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, []);

  const contextValue = useMemo(
    () => ({ user, loading, isAuthInitialized, signOut, refreshUser }),
    [user, loading, isAuthInitialized, signOut, refreshUser]
  );

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
