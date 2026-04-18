import { getAuth } from "@/lib/auth/adapter";
import { resolveUserRole } from "@/lib/auth/user-role";
import { isChinaRegion } from "@/lib/config/region";

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: AuthUser;
}

export interface AuthResponse {
  data: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
  error: Error | null;
}

export interface AuthClient {
  signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse>;
  signUp(params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
    };
  }): Promise<AuthResponse>;
  signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }>;
  toDefaultLoginPage?(redirectUrl?: string): Promise<void>;
  updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }>;
  signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }>;
  verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<AuthResponse>;
  signOut(): Promise<{ error: Error | null }>;
  getUser(): Promise<{ data: { user: AuthUser | null }; error: Error | null }>;
  getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }>;
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
  refreshUserProfile?(): Promise<void>;
}

class SupabaseAuthClient implements AuthClient {
  private supabase: any;
  private supabasePromise: Promise<any> | null = null;

  constructor() {
    this.supabasePromise = import("@/lib/integrations/supabase").then(({ supabase }) => {
      this.supabase = supabase;
      return supabase;
    });
  }

  private async ensureSupabase() {
    if (this.supabase) {
      return this.supabase;
    }

    if (this.supabasePromise) {
      return this.supabasePromise;
    }

    throw new Error("Supabase client initialization failed");
  }

  async refreshUserProfile(): Promise<void> {
    try {
      console.log("[Supabase Auth] Refreshing profile cache");

      const {
        data: { session },
        error: sessionError,
      } = await this.getSession();

      if (sessionError || !session?.access_token) {
        console.warn("[Supabase Auth] Session unavailable, skipped profile refresh");
        return;
      }

      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.warn("[Supabase Auth] Profile refresh failed:", response.status);
        return;
      }

      const fullProfile = await response.json();
      const { saveSupabaseUserCache } = await import(
        "@/lib/auth/auth-state-manager-intl"
      );

      saveSupabaseUserCache(fullProfile);
      console.log("[Supabase Auth] Profile cache refreshed");
    } catch (error) {
      console.warn("[Supabase Auth] Profile refresh failed:", error);
    }
  }

  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      const supabase = await this.ensureSupabase();
      const result = await supabase.auth.signInWithPassword(params);

      if (result.data.user && !result.error) {
        await this.refreshUserProfile();
      }

      return result;
    } catch (error) {
      return {
        data: { user: null, session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signUp(params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
    };
  }): Promise<AuthResponse> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.signUp(params);
    } catch (error) {
      return {
        data: { user: null, session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.signInWithOAuth(params);
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.updateUser(params);
    } catch (error) {
      return {
        data: { user: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.signInWithOtp(params);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<AuthResponse> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.verifyOtp(params);
    } catch (error) {
      return {
        data: { user: null, session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      const result = await supabase.auth.signOut();

      const { clearSupabaseUserCache } = await import(
        "@/lib/auth/auth-state-manager-intl"
      );
      clearSupabaseUserCache();

      return result;
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async getUser(): Promise<{
    data: { user: AuthUser | null };
    error: Error | null;
  }> {
    try {
      const { getSupabaseUserCache } = await import(
        "@/lib/auth/auth-state-manager-intl"
      );
      const cachedUser = getSupabaseUserCache();

      if (cachedUser) {
        console.log("[Supabase Auth] Using cached user profile");
        return {
          data: {
            user: {
              id: cachedUser.id,
              email: cachedUser.email,
              user_metadata: {
                full_name: cachedUser.name,
                avatar_url: cachedUser.avatar,
                role: cachedUser.role,
              },
            },
          },
          error: null,
        };
      }

      console.log("[Supabase Auth] Cache miss, falling back to session user");
      const supabase = await this.ensureSupabase();
      return await supabase.auth.getUser();
    } catch (error) {
      return {
        data: { user: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.getSession();
    } catch (error) {
      return {
        data: { session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } } {
    if (!this.supabase) {
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    }

    return this.supabase.auth.onAuthStateChange(callback);
  }
}

class CloudBaseAuthClient implements AuthClient {
  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      console.log(`[CloudBase Auth] Signing in with email: ${params.email}`);

      if (typeof window !== "undefined") {
        localStorage.setItem("DEBUG_LOGIN_STEP", "1_signin_start");
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const debugMessage = `[CloudBase Auth] Sign-in failed: ${errorData.error}`;

        console.error(debugMessage);
        if (typeof window !== "undefined") {
          localStorage.setItem("DEBUG_LOGIN_ERROR", debugMessage);
        }

        return {
          data: { user: null, session: null },
          error: new Error(
            errorData.details || errorData.error || "Login failed",
          ),
        };
      }

      const data = await response.json();
      console.log("[CloudBase Auth] Sign-in succeeded", {
        hasAccessToken: !!data.accessToken,
        hasRefreshToken: !!data.refreshToken,
        userId: data.user?.id,
        hasTokenMeta: !!data.tokenMeta,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("DEBUG_LOGIN_STEP", "2_signin_success");
        localStorage.setItem(
          "DEBUG_LOGIN_RESPONSE",
          JSON.stringify({
            hasAccessToken: !!data.accessToken,
            hasRefreshToken: !!data.refreshToken,
            userId: data.user?.id,
            hasTokenMeta: !!data.tokenMeta,
          }),
        );
      }

      if (data.accessToken && data.user && typeof window !== "undefined") {
        try {
          const { saveAuthState } = await import("@/lib/auth/auth-state-manager");

          saveAuthState(
            data.accessToken,
            data.refreshToken || data.accessToken,
            data.user,
            data.tokenMeta || {
              accessTokenExpiresIn: 3600,
              refreshTokenExpiresIn: 604800,
            },
          );

          localStorage.setItem("DEBUG_LOGIN_STEP", "3_auth_state_saved");
        } catch (error) {
          const debugMessage = `[CloudBase Auth] Failed to persist auth state: ${error}`;
          console.error(debugMessage);
          localStorage.setItem("DEBUG_LOGIN_ERROR", debugMessage);

          localStorage.setItem("auth-token", data.accessToken);
          localStorage.setItem("auth-user", JSON.stringify(data.user));
          localStorage.setItem("auth-logged-in", "true");
          localStorage.setItem("DEBUG_LOGIN_STEP", "3_token_saved_fallback");
        }
      } else if (typeof window !== "undefined") {
        const token = data.token || data.session?.access_token;
        if (token) {
          localStorage.setItem("auth-token", token);
          if (data.user) {
            localStorage.setItem("auth-user", JSON.stringify(data.user));
          }
          localStorage.setItem("auth-logged-in", "true");
          localStorage.setItem("DEBUG_LOGIN_STEP", "3_token_saved_legacy");
        }
      }

      const accessToken =
        data.accessToken || data.token || data.session?.access_token;

      return {
        data: {
          user: data.user,
          session:
            data.session ||
            (accessToken
              ? {
                  access_token: accessToken,
                  user: data.user,
                }
              : null),
        },
        error: null,
      };
    } catch (error) {
      const debugMessage = `[CloudBase Auth] Sign-in threw an error: ${error}`;
      console.error(debugMessage);

      if (typeof window !== "undefined") {
        localStorage.setItem("DEBUG_LOGIN_ERROR", debugMessage);
      }

      return {
        data: { user: null, session: null },
        error: error as Error,
      };
    }
  }

  async signUp(params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
    };
  }): Promise<AuthResponse> {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          confirmPassword: params.password,
          fullName: params.options?.data?.name || params.email.split("@")[0],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: { user: null, session: null },
          error: new Error(
            errorData.details || errorData.error || "Registration failed",
          ),
        };
      }

      const data = await response.json();
      return {
        data: {
          user: data.user,
          session: data.session,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error as Error,
      };
    }
  }

  async signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }> {
    return {
      data: null,
      error: new Error(
        `OAuth provider "${params.provider}" is not supported in China region.`,
      ),
    };
  }

  async toDefaultLoginPage(redirectUrl?: string): Promise<void> {
    const adapter = getAuth();
    if (!adapter.toDefaultLoginPage) {
      throw new Error("toDefaultLoginPage is not supported in this region");
    }

    await adapter.toDefaultLoginPage(redirectUrl);
  }

  async updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (typeof window !== "undefined") {
        const { getStoredAuthState } = await import(
          "@/lib/auth/auth-state-manager"
        );
        const authState = getStoredAuthState();
        if (authState?.accessToken) {
          headers.Authorization = `Bearer ${authState.accessToken}`;
        }
      }

      const response = await fetch("/api/auth/update", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: { user: null },
          error: new Error(
            errorData.details || errorData.error || "Update failed",
          ),
        };
      }

      const data = await response.json();
      return {
        data: { user: data.user },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: error as Error,
      };
    }
  }

  async signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }> {
    try {
      const response = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: params.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          error: new Error(
            errorData?.error?.message ||
              errorData?.details ||
              errorData?.error ||
              "Failed to send SMS code",
          ),
        };
      }

      return { error: null };
    } catch (error) {
      return {
        error: error as Error,
      };
    }
  }

  async verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<AuthResponse> {
    try {
      const response = await fetch("/api/auth/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: params.email,
          code: params.token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: { user: null, session: null },
          error: new Error(
            errorData?.error?.message ||
              errorData?.details ||
              errorData?.error ||
              "OTP verification failed",
          ),
        };
      }

      const data = await response.json();

      if (data.accessToken && data.user && typeof window !== "undefined") {
        try {
          const { saveAuthState } = await import("@/lib/auth/auth-state-manager");

          saveAuthState(
            data.accessToken,
            data.refreshToken || data.accessToken,
            data.user,
            data.tokenMeta || {
              accessTokenExpiresIn: 3600,
              refreshTokenExpiresIn: 604800,
            },
          );
        } catch (error) {
          console.error("[CloudBase Auth] Failed to persist phone OTP auth state:", error);
        }
      }

      const accessToken =
        data.accessToken || data.token || data.session?.access_token;

      return {
        data: {
          user: data.user || null,
          session:
            data.session ||
            (accessToken
              ? {
                  access_token: accessToken,
                  user: data.user || null,
                }
              : null),
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error as Error,
      };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    let requestError: Error | null = null;

    try {
      let headers: HeadersInit | undefined;

      if (typeof window !== "undefined") {
        const { getStoredAuthState } = await import(
          "@/lib/auth/auth-state-manager"
        );
        const authState = getStoredAuthState();
        if (authState?.accessToken) {
          headers = {
            Authorization: `Bearer ${authState.accessToken}`,
          };
        }
      }

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers,
      });

      // Keep logout idempotent on the client: local sign-out should still succeed
      // even if the server token is already invalid or revocation fails.
      if (!response.ok) {
        requestError = new Error(`Logout request failed (${response.status})`);
        console.warn("[CloudBase Auth] Logout request failed:", {
          status: response.status,
        });
      }
    } catch (error) {
      requestError =
        error instanceof Error ? error : new Error("Logout request failed");
      console.warn("[CloudBase Auth] Logout request threw:", requestError);
    } finally {
      if (typeof window !== "undefined") {
        const { clearAuthState } = await import("@/lib/auth/auth-state-manager");
        await clearAuthState();

        const keysToDelete: string[] = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key?.startsWith("DEBUG_")) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach((key) => localStorage.removeItem(key));
      }
    }

    // Do not surface request failure to UI after local sign-out is complete.
    void requestError;
    return { error: null };
  }

  async getUser(): Promise<{
    data: { user: AuthUser | null };
    error: Error | null;
  }> {
    try {
      const { getStoredAuthState } = await import("@/lib/auth/auth-state-manager");
      const authState = getStoredAuthState();

      if (!authState?.user) {
        console.log("[CloudBase Auth] No stored auth state found");
        return { data: { user: null }, error: null };
      }

      const authUser: AuthUser = {
        id: authState.user.id,
        email: authState.user.email,
        user_metadata: {
          full_name:
            authState.user.name ||
            authState.user.email?.split("@")[0] ||
            "用户",
          avatar_url: authState.user.avatar,
          role: authState.user.role,
        },
      };

      console.log("[CloudBase Auth] Loaded user from local auth state", authUser.id);
      return {
        data: { user: authUser },
        error: null,
      };
    } catch (error) {
      console.error("[CloudBase Auth] Failed to read user from auth state:", error);
      return { data: { user: null }, error: error as Error };
    }
  }

  async getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }> {
    if (typeof window !== "undefined") {
      try {
        const { getStoredAuthState } = await import(
          "@/lib/auth/auth-state-manager"
        );
        const authState = getStoredAuthState();

        if (authState?.user) {
          console.log("[CloudBase Auth] Loaded session from auth state");
          return {
            data: {
              session: {
                access_token: authState.accessToken,
                user: {
                  id: authState.user.id,
                  email: authState.user.email,
                  user_metadata: {
                    full_name:
                      authState.user.name ||
                      authState.user.email?.split("@")[0] ||
                      "用户",
                    avatar_url: authState.user.avatar,
                    role: authState.user.role,
                  },
                },
              },
            },
            error: null,
          };
        }
      } catch (error) {
        console.warn("[CloudBase Auth] Failed to read session from auth state:", error);
      }
    }

    const userResult = await this.getUser();
    if (userResult.data.user) {
      let token: string | null = null;

      if (typeof window !== "undefined") {
        try {
          const { getStoredAuthState } = await import(
            "@/lib/auth/auth-state-manager"
          );
          const authState = getStoredAuthState();
          token = authState?.accessToken || null;
        } catch (error) {
          console.warn("[CloudBase Auth] Failed to read access token:", error);
        }
      }

      return {
        data: {
          session: {
            access_token: token || "cloudbase-session",
            user: userResult.data.user,
          },
        },
        error: null,
      };
    }

    return { data: { session: null }, error: null };
  }

  onAuthStateChange(): { data: { subscription: { unsubscribe: () => void } } } {
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }
}

function createAuthClient(): AuthClient {
  if (isChinaRegion()) {
    console.log("[Auth Client] Using CloudBase auth client");
    return new CloudBaseAuthClient();
  }

  console.log("[Auth Client] Using Supabase auth client");
  return new SupabaseAuthClient();
}

let authClientInstance: AuthClient | null = null;

export function getAuthClient(): AuthClient {
  if (!authClientInstance) {
    authClientInstance = createAuthClient();
  }

  return authClientInstance;
}

export const auth = {
  get client() {
    return getAuthClient();
  },
  signInWithPassword: (params: { email: string; password: string }) =>
    getAuthClient().signInWithPassword(params),
  signUp: (params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
    };
  }) => getAuthClient().signUp(params),
  signInWithOtp: (params: { email: string; options?: any }) =>
    getAuthClient().signInWithOtp(params),
  verifyOtp: (params: { email: string; token: string; type: string }) =>
    getAuthClient().verifyOtp(params),
  signOut: () => getAuthClient().signOut(),
  getUser: () => getAuthClient().getUser(),
  getSession: () => getAuthClient().getSession(),
  onAuthStateChange: (
    callback: (event: string, session: AuthSession | null) => void,
  ) => getAuthClient().onAuthStateChange(callback),
  signInWithOAuth: (params: { provider: string; options?: any }) =>
    getAuthClient().signInWithOAuth(params),
  toDefaultLoginPage: (redirectUrl?: string) =>
    getAuthClient().toDefaultLoginPage?.(redirectUrl),
  refreshUserProfile: () => {
    const client = getAuthClient();
    if (typeof client.refreshUserProfile === "function") {
      return client.refreshUserProfile();
    }
    return Promise.resolve();
  },
};
