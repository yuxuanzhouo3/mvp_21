import { afterEach, describe, expect, test } from "@jest/globals";
import { validateEnvironment } from "@/lib/validation/env-validation";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("env validation production placeholder guard", () => {
  test("fails when production uses test Stripe keys", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "INTL";
    process.env.APP_URL = "https://app.example.org";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prod-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-prod-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-prod-key";
    process.env.OPENAI_MODEL = "gpt-4.1";
    process.env.STRIPE_SECRET_KEY = "sk_test_replace_me";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_replace_me";

    const result = validateEnvironment();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.join("\n")).toContain("sk_test_ keys are not allowed");
      expect(result.errors.join("\n")).toContain("pk_test_ keys are not allowed");
    }
  });

  test("passes with non-placeholder production values", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "INTL";
    process.env.APP_URL = "https://app.mornhub.quest";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prod-abc123.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-prod-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-prod-key";
    process.env.OPENAI_MODEL = "gpt-4.1";
    process.env.STRIPE_SECRET_KEY = "sk_live_123456789";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_123456789";

    const result = validateEnvironment();
    expect(result.success).toBe(true);
  });
});
