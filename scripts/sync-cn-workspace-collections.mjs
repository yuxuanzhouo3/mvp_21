import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const CloudBase = require("@cloudbase/manager-node");

const TARGET_COLLECTIONS = new Set(["workspace_members", "workspace_invites"]);

const ORDER_TO_DIRECTION = {
  asc: "1",
  desc: "-1",
  "1": "1",
  "-1": "-1",
  "2dsphere": "2dsphere",
};

function loadEnv() {
  dotenv.config({ path: path.join(process.cwd(), ".env.cn"), override: true });
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
}

function parseCollectionConfig() {
  const configPath = path.join(process.cwd(), "cloudbase-collections.json");
  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const collections = Array.isArray(parsed.collections) ? parsed.collections : [];

  return collections.filter((item) => TARGET_COLLECTIONS.has(item.name));
}

function normalizeDirection(order) {
  const key = String(order ?? "asc").toLowerCase();
  return ORDER_TO_DIRECTION[key] ?? "1";
}

function toCreateIndexPayload(indexDef) {
  return {
    IndexName: indexDef.name,
    MgoKeySchema: {
      MgoIsUnique: Boolean(indexDef.unique),
      MgoIndexKeys: (indexDef.keys ?? []).map((key) => ({
        Name: key.field,
        Direction: normalizeDirection(key.order),
      })),
    },
  };
}

function normalizeActualIndex(index) {
  return {
    name: index.Name,
    unique: Boolean(index.Unique),
    keys: (index.Keys ?? []).map((key) => ({
      name: key.Name,
      direction: String(key.Direction),
    })),
  };
}

function normalizeExpectedIndex(indexDef) {
  return {
    name: indexDef.name,
    unique: Boolean(indexDef.unique),
    keys: (indexDef.keys ?? []).map((key) => ({
      name: key.field,
      direction: normalizeDirection(key.order),
    })),
  };
}

function sameIndexShape(actual, expected) {
  if (!actual || !expected) return false;
  if (actual.unique !== expected.unique) return false;
  if (actual.keys.length !== expected.keys.length) return false;

  for (let i = 0; i < actual.keys.length; i += 1) {
    if (actual.keys[i].name !== expected.keys[i].name) return false;
    if (String(actual.keys[i].direction) !== String(expected.keys[i].direction)) {
      return false;
    }
  }

  return true;
}

function listExpectedIndexNames(collection) {
  return (collection.indexes ?? []).map((index) => index.name);
}

async function ensureCollectionAndIndexes(database, collection) {
  const collectionName = collection.name;
  const creation = await database.createCollectionIfNotExists(collectionName);
  const before = await database.describeCollection(collectionName);
  const actualByName = new Map(
    (before.Indexes ?? []).map((index) => {
      const normalized = normalizeActualIndex(index);
      return [normalized.name, normalized];
    }),
  );

  const indexesToCreate = [];
  const indexesToDrop = [];

  for (const expectedDef of collection.indexes ?? []) {
    const expected = normalizeExpectedIndex(expectedDef);
    const actual = actualByName.get(expected.name);

    if (!actual) {
      indexesToCreate.push(toCreateIndexPayload(expectedDef));
      continue;
    }

    if (!sameIndexShape(actual, expected)) {
      indexesToDrop.push({ IndexName: expected.name });
      indexesToCreate.push(toCreateIndexPayload(expectedDef));
    }
  }

  if (indexesToCreate.length > 0 || indexesToDrop.length > 0) {
    const payload = {};
    if (indexesToCreate.length > 0) payload.CreateIndexes = indexesToCreate;
    if (indexesToDrop.length > 0) payload.DropIndexes = indexesToDrop;
    await database.updateCollection(collectionName, payload);
  }

  const after = await database.describeCollection(collectionName);
  const afterNames = new Set((after.Indexes ?? []).map((idx) => idx.Name));
  const missing = listExpectedIndexNames(collection).filter(
    (name) => !afterNames.has(name),
  );

  return {
    collectionName,
    createdCollection: Boolean(creation?.IsCreated),
    createdIndexes: indexesToCreate.map((item) => item.IndexName),
    droppedIndexes: indexesToDrop.map((item) => item.IndexName),
    missingIndexes: missing,
  };
}

async function main() {
  loadEnv();

  const envId =
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID || process.env.CLOUDBASE_ENV_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;

  if (!envId || !secretId || !secretKey) {
    throw new Error(
      "缺少 CloudBase 凭据：需要 NEXT_PUBLIC_WECHAT_CLOUDBASE_ID/CLOUDBASE_ENV_ID、CLOUDBASE_SECRET_ID、CLOUDBASE_SECRET_KEY。",
    );
  }

  const workspaceCollections = parseCollectionConfig();
  if (workspaceCollections.length !== TARGET_COLLECTIONS.size) {
    throw new Error(
      "cloudbase-collections.json 缺少 workspace_members 或 workspace_invites 定义。",
    );
  }

  const app = CloudBase.init({
    envId,
    secretId,
    secretKey,
  });

  const database = app.database;
  const results = [];

  for (const collection of workspaceCollections) {
    // 顺序执行，避免索引更新请求并发冲突。
    const result = await ensureCollectionAndIndexes(database, collection);
    results.push(result);
  }

  console.log("中国区 workspace 集合同步结果：");
  for (const item of results) {
    console.log(
      `- ${item.collectionName}: collection=${item.createdCollection ? "created" : "existing"}, createIndexes=${item.createdIndexes.length}, dropIndexes=${item.droppedIndexes.length}, missingIndexes=${item.missingIndexes.length}`,
    );
    if (item.createdIndexes.length > 0) {
      console.log(`  created: ${item.createdIndexes.join(", ")}`);
    }
    if (item.droppedIndexes.length > 0) {
      console.log(`  dropped: ${item.droppedIndexes.join(", ")}`);
    }
  }

  const missingTotal = results.reduce(
    (sum, item) => sum + item.missingIndexes.length,
    0,
  );
  if (missingTotal > 0) {
    throw new Error("索引校验未通过，仍有目标索引缺失。");
  }

  console.log("中国区 workspace 集合与索引已完成创建/校验。");
}

main().catch((error) => {
  console.error("同步中国区 workspace 集合失败：", error?.message || error);
  process.exit(1);
});
