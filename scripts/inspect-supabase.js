const { createClient } = require("@supabase/supabase-js");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.intl") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase environment variables.");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function inspectDatabase() {
  const tablesToCheck = [
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

  console.log("Inspecting Supabase tables...\n");

  for (const table of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .limit(1);

      if (error) {
        console.log(`- ${table}: ERROR (${error.message})`);
        continue;
      }

      console.log(`- ${table}: OK (rows: ${count ?? 0})`);
      if (data?.[0]) {
        const columns = Object.keys(data[0]);
        console.log(`  columns sample: ${columns.join(", ")}`);
      }
    } catch (error) {
      console.log(`- ${table}: EXCEPTION (${error.message})`);
    }
  }
}

inspectDatabase().catch((error) => {
  console.error("Supabase inspect failed:", error);
  process.exit(1);
});
