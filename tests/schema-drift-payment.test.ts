import { describe, expect, test } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("payment schema drift guards", () => {
  test("schema baseline includes payment/subscription/webhook critical fields", () => {
    const schema = readWorkspaceFile("supabase/schema.sql");

    const requiredSchemaTokens = [
      "CREATE TABLE IF NOT EXISTS payments",
      "transaction_id",
      "order_id",
      "out_trade_no",
      "plan_id",
      "CREATE TABLE IF NOT EXISTS subscriptions",
      "provider_subscription_id",
      "current_period_end",
      "CREATE TABLE IF NOT EXISTS webhook_events",
      "processed",
    ];

    for (const token of requiredSchemaTokens) {
      expect(schema).toContain(token);
    }

    expect(schema).toContain("'paypal'");
  });

  test("migrations include payment alignment artifacts", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir);
    const merged = migrationFiles
      .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
      .join("\n");

    const requiredMigrationTokens = [
      "transaction_id",
      "order_id",
      "out_trade_no",
      "provider_subscription_id",
      "current_period_end",
      "webhook_events",
    ];

    for (const token of requiredMigrationTokens) {
      expect(merged).toContain(token);
    }

    expect(merged).toContain("IN ('stripe', 'paypal', 'alipay', 'wechat')");
  });
});
