import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";

import {
  getStoredAuthState,
  syncAuthCookiesFromStoredState,
  type StoredAuthState,
} from "@/lib/auth/auth-state-manager";

const localStorageState = new Map<string, string>();
let cookieJar = "";

function defineBrowserGlobals() {
  Object.defineProperty(global, "window", {
    value: {
      dispatchEvent: () => true,
    },
    configurable: true,
  });

  Object.defineProperty(global, "CustomEvent", {
    value: class CustomEventMock {
      detail: unknown;
      constructor(_type: string, init?: { detail?: unknown }) {
        this.detail = init?.detail;
      }
    },
    configurable: true,
  });

  Object.defineProperty(global, "document", {
    value: {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        cookieJar = cookieJar ? `${cookieJar}; ${value}` : value;
      },
    },
    configurable: true,
  });

  Object.defineProperty(global, "localStorage", {
    value: {
      getItem: (key: string) => localStorageState.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageState.set(key, value);
      },
      removeItem: (key: string) => {
        localStorageState.delete(key);
      },
    },
    configurable: true,
  });
}

describe("auth state manager cookie sync", () => {
  beforeEach(() => {
    cookieJar = "";
    localStorageState.clear();
    defineBrowserGlobals();
  });

  afterEach(() => {
    localStorageState.clear();
    cookieJar = "";
  });

  test("syncAuthCookiesFromStoredState writes middleware cookies when refresh token remains valid", () => {
    const authState: StoredAuthState = {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "admin",
      },
      tokenMeta: {
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 3600,
      },
      savedAt: Date.now(),
    };

    expect(syncAuthCookiesFromStoredState(authState)).toBe(true);
    expect(cookieJar).toContain("auth-logged-in=1");
    expect(cookieJar).toContain("auth-role=admin");
  });

  test("getStoredAuthState clears expired local auth state instead of restoring a stale user", () => {
    localStorageState.set(
      "app-auth-state",
      JSON.stringify({
        accessToken: "expired-access",
        refreshToken: "expired-refresh",
        user: {
          id: "user-1",
          email: "user@example.com",
          role: "user",
        },
        tokenMeta: {
          accessTokenExpiresIn: 10,
          refreshTokenExpiresIn: 10,
        },
        savedAt: Date.now() - 60_000,
      }),
    );

    expect(getStoredAuthState()).toBeNull();
    expect(localStorageState.get("app-auth-state")).toBeUndefined();
  });
});
