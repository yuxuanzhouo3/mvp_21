const fs = require("fs");
const path = require("path");
const readline = require("readline");
const cloudbase = require("@cloudbase/node-sdk");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

const PROJECT_ROOT = path.join(__dirname, "..");

for (const envFile of [".env.local", ".env.cn", ".env.intl"]) {
  const fullPath = path.join(PROJECT_ROOT, envFile);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: false });
  }
}

function resolveDeploymentRegion() {
  const candidates = [
    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION,
    process.env.DEPLOYMENT_REGION,
    process.env.NEXT_PUBLIC_APP_REGION,
    process.env.APP_REGION,
  ];

  for (const value of candidates) {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "CN" || normalized === "INTL") {
      return normalized;
    }
  }

  return "CN";
}

function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function ensureCnCollection(db, collectionName) {
  try {
    await db.collection(collectionName).limit(1).get();
  } catch (error) {
    const message = String(error && error.message ? error.message : "");
    const code = String(error && error.code ? error.code : "");
    const missing =
      message.includes("Db or Table not exist") ||
      message.includes("DATABASE_COLLECTION_NOT_EXIST") ||
      code.includes("DATABASE_COLLECTION_NOT_EXIST");

    if (!missing) {
      throw error;
    }

    await db.createCollection(collectionName);
  }
}

async function upsertCnAdmin(username, passwordHash) {
  const envId =
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID ||
    process.env.CLOUDBASE_ENV_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;

  if (!envId || !secretId || !secretKey) {
    throw new Error(
      "Missing CloudBase credentials. Required: NEXT_PUBLIC_WECHAT_CLOUDBASE_ID/CLOUDBASE_ENV_ID, CLOUDBASE_SECRET_ID, CLOUDBASE_SECRET_KEY.",
    );
  }

  const app = cloudbase.init({
    env: envId,
    secretId,
    secretKey,
  });
  const db = app.database();
  const now = new Date().toISOString();

  await ensureCnCollection(db, "admin_users");

  const existingResult = await db
    .collection("admin_users")
    .where({ username })
    .limit(1)
    .get();
  const existing = existingResult.data && existingResult.data[0];

  if (existing) {
    const docId = existing._id || existing.id;
    if (!docId) {
      throw new Error("Found existing admin but could not resolve document id.");
    }

    await db.collection("admin_users").doc(docId).update({
      password_hash: passwordHash,
      status: "active",
      updated_at: now,
    });

    return {
      created: false,
      username,
      role: existing.role || "super_admin",
    };
  }

  await db.collection("admin_users").add({
    username,
    password_hash: passwordHash,
    role: "super_admin",
    status: "active",
    created_at: now,
    updated_at: now,
  });

  return {
    created: true,
    username,
    role: "super_admin",
  };
}

async function upsertIntlAdmin(username, passwordHash) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const now = new Date().toISOString();

  const existingResult = await supabase
    .from("admins")
    .select("id, role")
    .eq("username", username)
    .maybeSingle();

  if (existingResult.error) {
    throw existingResult.error;
  }

  if (existingResult.data) {
    const updateResult = await supabase
      .from("admins")
      .update({
        password_hash: passwordHash,
        status: "active",
        updated_at: now,
      })
      .eq("id", existingResult.data.id);

    if (updateResult.error) {
      throw updateResult.error;
    }

    return {
      created: false,
      username,
      role: existingResult.data.role || "super_admin",
    };
  }

  const insertResult = await supabase.from("admins").insert({
    username,
    password_hash: passwordHash,
    role: "super_admin",
    status: "active",
    created_at: now,
    updated_at: now,
  });

  if (insertResult.error) {
    throw insertResult.error;
  }

  return {
    created: true,
    username,
    role: "super_admin",
  };
}

async function main() {
  const rl = createPrompt();

  try {
    console.log("=== Create /admin initial account ===\n");

    const username = String(await ask(rl, "Admin username: ")).trim();
    const password = String(await ask(rl, "Admin password: ")).trim();

    if (!username || !password) {
      throw new Error("Username and password are required.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const region = resolveDeploymentRegion();
    const result =
      region === "INTL"
        ? await upsertIntlAdmin(username, passwordHash)
        : await upsertCnAdmin(username, passwordHash);

    console.log("");
    console.log(result.created ? "Admin account created." : "Admin password updated.");
    console.log(`Region: ${region}`);
    console.log(`Username: ${result.username}`);
    console.log(`Role: ${result.role}`);
    console.log("");
    console.log("You can now sign in at /admin/login.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("");
    console.error("Failed to create admin account:");
    console.error(message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
