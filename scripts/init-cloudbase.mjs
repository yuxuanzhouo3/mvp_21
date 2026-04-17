import cloudbase from "@cloudbase/node-sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const cloudbaseId =
  process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID ||
  process.env.CLOUDBASE_ENV_ID ||
  "contracthub-2go0kvke215f83c1";
const secretId = process.env.CLOUDBASE_SECRET_ID;
const secretKey = process.env.CLOUDBASE_SECRET_KEY;

const collections = [
  {
    name: "web_users",
    description: "用户主表",
  },
  {
    name: "company_profiles",
    description: "企业档案表",
  },
  {
    name: "contracts",
    description: "合同表",
  },
  {
    name: "subscriptions",
    description: "订阅表",
  },
  {
    name: "payments",
    description: "支付表",
  },
  {
    name: "refresh_tokens",
    description: "刷新令牌表",
  },
  {
    name: "email_verification_codes",
    description: "邮箱验证码记录表",
  },
  {
    name: "password_reset_tokens",
    description: "密码重置令牌表",
  },
  {
    name: "security_logs",
    description: "安全日志表",
  },
  {
    name: "wechat_logins",
    description: "微信登录表",
  },
  {
    name: "ai_conversations",
    description: "AI 对话记录表",
  },
];

console.log("开始初始化 CloudBase 集合");
console.log(`环境 ID: ${cloudbaseId}\n`);

if (!secretId || !secretKey) {
  console.error("缺少 CloudBase 凭据，请在 .env.local 中配置：");
  console.error(`CLOUDBASE_SECRET_ID: ${secretId ? "已配置" : "缺失"}`);
  console.error(`CLOUDBASE_SECRET_KEY: ${secretKey ? "已配置" : "缺失"}`);
  process.exit(1);
}

const app = cloudbase.init({
  env: cloudbaseId,
  secretId,
  secretKey,
});

const db = app.database();

async function checkAndCreateCollection(name, description) {
  try {
    await db.collection(name).limit(1).get();
    console.log(`已存在: ${name} (${description})`);
    return { name, status: "existing" };
  } catch (error) {
    const message = error?.message || "";
    const code = error?.code || "";
    const notFound =
      code === "DATABASE_COLLECTION_NOT_EXIST" ||
      message.includes("not exist");

    if (!notFound) {
      console.error(`检查 ${name} 失败: ${message}`);
      return { name, status: "failed", error: message };
    }

    try {
      await db.createCollection(name);
      console.log(`已创建: ${name} (${description})`);
      return { name, status: "created" };
    } catch (createError) {
      const createMessage = createError?.message || String(createError);
      console.error(`创建 ${name} 失败: ${createMessage}`);
      return { name, status: "failed", error: createMessage };
    }
  }
}

async function initializeDatabase() {
  const results = {
    existing: [],
    created: [],
    failed: [],
  };

  for (const collection of collections) {
    const result = await checkAndCreateCollection(
      collection.name,
      collection.description,
    );

    if (result.status === "existing") {
      results.existing.push(result.name);
    } else if (result.status === "created") {
      results.created.push(result.name);
    } else {
      results.failed.push(result);
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log("\n初始化结果");
  console.log(`已存在: ${results.existing.length}`);
  console.log(`已创建: ${results.created.length}`);
  console.log(`失败: ${results.failed.length}`);

  if (results.created.length) {
    console.log(`新创建集合: ${results.created.join(", ")}`);
  }

  if (results.failed.length) {
    console.log("以下集合需要手动检查：");
    for (const item of results.failed) {
      console.log(`- ${item.name}: ${item.error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("CloudBase 集合初始化完成。");
}

initializeDatabase().catch((error) => {
  console.error("CloudBase 初始化失败:", error);
  process.exit(1);
});
