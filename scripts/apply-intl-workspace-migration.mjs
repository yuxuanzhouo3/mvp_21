import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const REQUIRED_MIGRATION = "20260412_dashboard_workspace_invites.sql";

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
    throw new Error(`读取 Supabase OpenAPI 失败: HTTP ${response.status} ${body}`);
  }

  const doc = await response.json();
  return Object.keys(doc.paths ?? {});
}

function hasWorkspaceInviteTables(paths) {
  const set = new Set(paths);
  return {
    workspaceMembers: set.has("/workspace_members"),
    workspaceInvites: set.has("/workspace_invites"),
  };
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

  throw new Error("未找到 Supabase CLI（supabase.exe / supabase）。");
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "缺少 Supabase 配置：需要 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。",
    );
  }

  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    REQUIRED_MIGRATION,
  );
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`缺少 migration 文件: ${migrationPath}`);
  }

  const beforePaths = await readOpenApiPaths({ supabaseUrl, serviceRoleKey });
  const before = hasWorkspaceInviteTables(beforePaths);

  console.log(
    `国际区当前表状态: workspace_members=${before.workspaceMembers}, workspace_invites=${before.workspaceInvites}`,
  );

  if (before.workspaceMembers && before.workspaceInvites) {
    console.log("国际区 workspace 团队表已存在，无需重复执行 migration。");
    return;
  }

  if (!accessToken) {
    throw new Error(
      "缺少 SUPABASE_ACCESS_TOKEN，无法在当前会话执行远程 migration。请配置后重试：npm run db:workspace:intl",
    );
  }

  const projectRef = getProjectRefFromUrl(supabaseUrl);
  if (!projectRef) {
    throw new Error(`无法从 NEXT_PUBLIC_SUPABASE_URL 解析 project ref: ${supabaseUrl}`);
  }

  const commandEnv = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: accessToken,
  };

  console.log(`开始链接 Supabase 项目: ${projectRef}`);
  const linkRes = runSupabaseCommand(
    ["link", "--project-ref", projectRef, "--yes"],
    commandEnv,
  );
  if (linkRes.status !== 0) {
    throw new Error(
      `supabase link 执行失败。\n${linkRes.stdout || ""}\n${linkRes.stderr || ""}`.trim(),
    );
  }

  console.log("开始执行 migration push（包含最新迁移）...");
  const pushRes = runSupabaseCommand(["db", "push", "--include-all", "--yes"], commandEnv);
  if (pushRes.status !== 0) {
    throw new Error(
      `supabase db push 执行失败。\n${pushRes.stdout || ""}\n${pushRes.stderr || ""}`.trim(),
    );
  }

  const afterPaths = await readOpenApiPaths({ supabaseUrl, serviceRoleKey });
  const after = hasWorkspaceInviteTables(afterPaths);
  console.log(
    `国际区执行后表状态: workspace_members=${after.workspaceMembers}, workspace_invites=${after.workspaceInvites}`,
  );

  if (!after.workspaceInvites) {
    throw new Error(
      `migration 执行后仍未发现 workspace_invites，请检查 ${REQUIRED_MIGRATION} 是否被应用。`,
    );
  }

  console.log("国际区 Supabase workspace 邀请相关 migration 已完成。");
}

main().catch((error) => {
  console.error("国际区 migration 执行失败：", error?.message || error);
  process.exit(1);
});
