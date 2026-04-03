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

const rootDir = process.cwd();
const sourceFile = path.join(rootDir, sourceMap[target]);
const targetFile = path.join(rootDir, ".env.local");

if (!fs.existsSync(sourceFile)) {
  console.error(`Missing source env file: ${sourceMap[target]}`);
  process.exit(1);
}

fs.copyFileSync(sourceFile, targetFile);
console.log(`Active env switched to ${sourceMap[target]} -> .env.local`);
