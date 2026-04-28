import fs from "node:fs";
import path from "node:path";

const target = (process.argv[2] || "").trim().toLowerCase();

const sourceMap = {
  cn: ".env.cn",
  intl: ".env.intl",
};

if (!sourceMap[target]) {
  console.error('Usage: node scripts/use-env.mjs <cn|intl>');
  process.exit(1);
}

function parseEnvFile(fileContent) {
  const entries = new Map();

  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.set(key, value);
  }

  return entries;
}

function hasValue(envEntries, key) {
  return Boolean((envEntries.get(key) || "").trim());
}

function validateSourceEnv(targetName, envEntries) {
  const expectedRegion = targetName === "cn" ? "CN" : "INTL";
  const regionKeys = [
    "NEXT_PUBLIC_DEPLOYMENT_REGION",
    "APP_REGION",
    "NEXT_PUBLIC_APP_REGION",
  ];

  const requiredByTarget = {
    cn: [
      "APP_URL",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_WECHAT_CLOUDBASE_ID",
      "CLOUDBASE_SECRET_ID",
      "CLOUDBASE_SECRET_KEY",
      "TENCENT_SMS_APP_ID",
      "TENCENT_SMS_SIGN_NAME",
      "TENCENT_SMS_TEMPLATE_ID",
      "TENCENT_SMS_SECRET_ID",
      "TENCENT_SMS_SECRET_KEY",
    ],
    intl: [
      "APP_URL",
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "DASHSCOPE_API_KEY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    ],
  };

  const errors = [];

  for (const key of regionKeys) {
    if (!hasValue(envEntries, key)) {
      continue;
    }
    const value = (envEntries.get(key) || "").trim().toUpperCase();
    if (value !== expectedRegion) {
      errors.push(`${key} expected ${expectedRegion}, but got ${value}`);
    }
  }

  if (!hasValue(envEntries, "NEXT_PUBLIC_DEPLOYMENT_REGION")) {
    errors.push("NEXT_PUBLIC_DEPLOYMENT_REGION is required");
  }

  for (const key of requiredByTarget[targetName]) {
    if (!hasValue(envEntries, key)) {
      errors.push(`${key} is required for ${expectedRegion} deployment`);
    }
  }

  return { errors };
}

const rootDir = process.cwd();
const sourceFile = path.join(rootDir, sourceMap[target]);
const targetFile = path.join(rootDir, ".env.local");

if (!fs.existsSync(sourceFile)) {
  console.error(`Missing source env file: ${sourceMap[target]}`);
  process.exit(1);
}

const sourceContent = fs.readFileSync(sourceFile, "utf8");
const envEntries = parseEnvFile(sourceContent);
const validation = validateSourceEnv(target, envEntries);

if (validation.errors.length > 0) {
  console.error(`Env validation failed for ${sourceMap[target]}:`);
  for (const issue of validation.errors) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

fs.copyFileSync(sourceFile, targetFile);
console.log(`Active env switched to ${sourceMap[target]} -> .env.local`);
