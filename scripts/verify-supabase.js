const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.intl") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enableWriteTest = process.env.SUPABASE_VERIFY_WRITE_TEST === "true";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase environment variables.");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function verifyDatabase() {
  const tables = [
    "users",
    "user_sessions",
    "contracts",
    "contract_templates",
    "subscriptions",
    "payments",
    "ads",
    "ad_stats",
    "company_profiles",
    "workspace_members",
    "admin_audit_logs",
  ];

  console.log("Verifying Supabase table access...\n");

  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(`- ${table}: ERROR (${error.message})`);
      } else {
        console.log(`- ${table}: OK (rows: ${count ?? 0})`);
      }
    } catch (error) {
      console.log(`- ${table}: EXCEPTION (${error.message})`);
    }
  }

  if (!enableWriteTest) {
    console.log(
      "\nWrite test skipped. Set SUPABASE_VERIFY_WRITE_TEST=true to enable.",
    );
    return;
  }

  console.log("\nRunning write test on users table...");

  try {
    const uniqueEmail = `verify-${Date.now()}@example.local`;
    const { error } = await supabase.from("users").insert({
      email: uniqueEmail,
      name: "Supabase Verify Script",
      role: "user",
      plan: "free",
      status: "active",
    });

    if (error) {
      console.log(`Write test failed: ${error.message}`);
      return;
    }

    console.log("Write test passed.");
  } catch (error) {
    console.log(`Write test exception: ${error.message}`);
  }
}

verifyDatabase().catch((error) => {
  console.error("Supabase verification failed:", error);
  process.exit(1);
});
