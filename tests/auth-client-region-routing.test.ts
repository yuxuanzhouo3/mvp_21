import { describe, expect, jest, test } from "@jest/globals";

describe("auth client region routing", () => {
  test("uses Supabase auth client in INTL runtime region", async () => {
    jest.resetModules();

    const mockSignInWithPassword = jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    jest.doMock("@/lib/config/region", () => ({
      isChinaRegion: () => false,
    }));
    jest.doMock("@/lib/integrations/supabase", () => ({
      supabase: {
        auth: {
          signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
          signUp: jest.fn(),
          signInWithOAuth: jest.fn(),
          updateUser: jest.fn(),
          signInWithOtp: jest.fn(),
          verifyOtp: jest.fn(),
          signOut: jest.fn(),
          getUser: jest.fn(),
          getSession: jest.fn(),
          onAuthStateChange: jest.fn(() => ({
            data: { subscription: { unsubscribe: jest.fn() } },
          })),
        },
      },
    }));

    const { getAuthClient } = await import("@/lib/auth/client");
    const client = getAuthClient();
    await client.signInWithPassword({
      email: "intl@example.com",
      password: "password123",
    });

    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
  });

  test("uses CloudBase auth client in CN runtime region", async () => {
    jest.resetModules();

    jest.doMock("@/lib/config/region", () => ({
      isChinaRegion: () => true,
    }));

    const { getAuthClient } = await import("@/lib/auth/client");
    const client = getAuthClient();

    const result = await client.signInWithOAuth({
      provider: "google",
    });

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain("not supported in China region");
  });
});
