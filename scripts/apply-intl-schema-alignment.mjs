import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const REQUIRED_MIGRATION = "20260419_intl_admin_console_alignment.sql";
const REQUIRED_TABLES = [
  "admins",
  "system_logs",
  "system_config",
  "orders",
  "advertisements",
  "social_links",
  "releases",
  "contract_templates",
  "subscriptions",
  "payments",
  "workspace_members",
  "workspace_invites",
  "workspace_documents",
  "document_share_links",
  "admin_audit_logs",
  "admin_settings",
];

function loadEnv() {
  dotenv.config({ path: path.join(process.cwd(), ".env.intl"), override: true });
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
}

function getProjectRefFromUrl(supabaseUrl) {
  const match = String(supabaseUrl).match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? "";
}

async function readOpenApiPaths({ supabaseUrl, serviceRoleKey }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Read Supabase OpenAPI failed: HTTP ${response.status} ${body}`);
  }

  const doc = await response.json();
  return Object.keys(doc.paths ?? {});
}

function summarizeTables(paths) {
  const set = new Set(paths);
  return REQUIRED_TABLES.reduce((result, table) => {
    result[table] = set.has(`/${table}`);
    return result;
  }, {});
}

function allTablesPresent(summary) {
  return REQUIRED_TABLES.every((table) => summary[table]);
}

function runSupabaseCommand(args, env) {
  const candidates = [
    path.join(process.cwd(), "supabase.exe"),
    path.join(process.cwd(), "supabase"),
    "supabase",
  ];

  for (const command of candidates) {
    const res = spawnSync(command, args, {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      shell: false,
    });

    if (res.error && res.error.code === "ENOENT") {
      continue;
    }

    return { command, ...res };
  }

  throw new Error("Supabase CLI was not found (supabase.exe / supabase).");
}

function formatSummary(summary) {
  return REQUIRED_TABLES.map((table) => `${table}=${summary[table]}`).join(", ");
}

async function runManagementApiQuery({
  projectRef,
  accessToken,
  query,
  readOnly = false,
}) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        read_only: readOnly,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase Management API query failed: HTTP ${response.status} ${body}`);
  }
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    REQUIRED_MIGRATION,
  );

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Missing migration file: ${migrationPath}`);
  }

  const beforeSummary = summarizeTables(
    await readOpenApiPaths({ supabaseUrl, serviceRoleKey }),
  );

  console.log(`INTL schema before push: ${formatSummary(beforeSummary)}`);

  if (allTablesPresent(beforeSummary)) {
    console.log("Required INTL tables already exist. No schema push needed.");
    return;
  }

  if (!accessToken) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is missing. Add it before running the remote schema push.",
    );
  }

  const projectRef = getProjectRefFromUrl(supabaseUrl);
  if (!projectRef) {
    throw new Error(`Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
  }

  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  const commandEnv = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: accessToken,
  };

  const hasDbPassword = Boolean(process.env.SUPABASE_DB_PASSWORD);

  if (!hasDbPassword) {
    console.log("SUPABASE_DB_PASSWORD is missing. Applying INTL schema via Management API...");
    await runManagementApiQuery({
      projectRef,
      accessToken,
      query: migrationSql,
    });
  } else {
    console.log(`Linking Supabase project: ${projectRef}`);
    const linkRes = runSupabaseCommand(
      ["link", "--project-ref", projectRef, "--yes"],
      commandEnv,
    );
    if (linkRes.status !== 0) {
      throw new Error(
        `supabase link failed.\n${linkRes.stdout || ""}\n${linkRes.stderr || ""}`.trim(),
      );
    }

    console.log("Pushing INTL schema migrations...");
    const pushRes = runSupabaseCommand(
      ["db", "push", "--include-all", "--yes"],
      commandEnv,
    );
    if (pushRes.status !== 0) {
      const failureText = `${pushRes.stdout || ""}\n${pushRes.stderr || ""}`.trim();
      const canFallbackToApi =
        failureText.includes("SUPABASE_DB_PASSWORD") ||
        failureText.includes("permission denied to alter role");

      if (!canFallbackToApi) {
        throw new Error(`supabase db push failed.\n${failureText}`.trim());
      }

      console.log("CLI push requires DB password. Falling back to Management API...");
      await runManagementApiQuery({
        projectRef,
        accessToken,
        query: migrationSql,
      });
    }
  }

  const afterSummary = summarizeTables(
    await readOpenApiPaths({ supabaseUrl, serviceRoleKey }),
  );
  console.log(`INTL schema after push: ${formatSummary(afterSummary)}`);

  if (!allTablesPresent(afterSummary)) {
    throw new Error("Schema push completed, but some required INTL tables are still missing.");
  }

  console.log("INTL Supabase schema alignment completed.");
}

main().catch((error) => {
  console.error("[apply-intl-schema-alignment] Failed:", error?.message || error);
  process.exit(1);
});
