# MornContract

一个基于 **Next.js 15 + React 19 + TypeScript** 的智能合同平台，支持：

- 合同创建、编辑、签署与导出
- 控制台与管理后台（`/dashboard`、`/admin`）
- 双区域部署模式：`CN`（CloudBase）与 `INTL`（Supabase）
- 支付能力（按区域启用：`CN` 可接微信/支付宝，`INTL` 使用 Stripe）
- AI 合同分析/生成能力（按区域使用不同模型提供方）

---

## 1. 快速开始（本地复现）

### 1.1 环境要求

- Node.js `>= 20`（推荐 LTS）
- npm `>= 10`（项目默认 npm 脚本）
- Git
- 可选：Supabase CLI（仓库根目录已包含 `supabase.exe`，Windows 可直接用）

### 1.2 克隆项目

```bash
git clone <your-repo-url>.git
cd new
```

### 1.3 安装依赖

```bash
npm install
```

### 1.4 选择部署区域并配置环境变量

本项目使用以下文件切换环境：

- `CN`：`.env.cn`
- `INTL`：`.env.intl`
- 运行时实际读取：`.env.local`（由脚本自动覆盖）

先复制模板：

```bash
# CN 模式
cp .env.cn.example .env.cn

# INTL 模式
cp .env.intl.example .env.intl
```

然后填写你自己的密钥（下面第 3 节有逐项说明）。

### 1.5 启动开发环境

```bash
# 中国区开发
npm run dev:cn

# 国际区开发
npm run dev:intl
```

访问：[http://localhost:3000](http://localhost:3000)

---

## 2. 数据库与初始化

## 2.1 INTL（Supabase）初始化

1. 确保 `.env.intl` 已配置：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. 切换 INTL 环境：

```bash
npm run env:intl
```

3. 应用 INTL Schema 对齐脚本：

```bash
npm run db:schema:intl
```

4. 应用 workspace 相关迁移：

```bash
npm run db:workspace:intl
```

> 说明：如需远程推送迁移，脚本可能要求 `SUPABASE_ACCESS_TOKEN`（某些场景还会用到 `SUPABASE_DB_PASSWORD`）。

## 2.2 CN（CloudBase）初始化

1. 确保 `.env.cn` 已配置：
   - `NEXT_PUBLIC_WECHAT_CLOUDBASE_ID`
   - `CLOUDBASE_SECRET_ID`
   - `CLOUDBASE_SECRET_KEY`
2. 切换 CN 环境：

```bash
npm run env:cn
```

3. 同步 workspace 集合与索引：

```bash
npm run db:workspace:cn
```

## 2.3 创建管理后台初始账号

```bash
npm run admin:create
```

脚本会交互输入用户名和密码，完成后可访问 `/admin/login` 登录。

---

## 3. 环境变量与密钥配置（不泄露真实值）

**安全原则：**

- `.env*` 已在 `.gitignore` 中忽略，禁止提交真实密钥
- 只提交 `*.example` 模板
- 前端可见变量必须以 `NEXT_PUBLIC_` 开头；其余一律仅服务端使用

## 3.1 必填变量（按部署区域）

### CN 模式（最小必填）

- 基础：
  - `NEXT_PUBLIC_DEPLOYMENT_REGION=CN`
  - `APP_URL` / `NEXT_PUBLIC_APP_URL`
- CloudBase：
  - `NEXT_PUBLIC_WECHAT_CLOUDBASE_ID`
  - `CLOUDBASE_SECRET_ID`
  - `CLOUDBASE_SECRET_KEY`
- 鉴权：
  - `JWT_SECRET`（建议 64+ 随机字符）
- 短信登录（腾讯云 SMS）：
  - `TENCENT_SMS_APP_ID`
  - `TENCENT_SMS_SIGN_NAME`
  - `TENCENT_SMS_TEMPLATE_ID`
  - `TENCENT_SMS_SECRET_ID`
  - `TENCENT_SMS_SECRET_KEY`

### INTL 模式（最小必填）

- 基础：
  - `NEXT_PUBLIC_DEPLOYMENT_REGION=INTL`
  - `APP_URL` / `NEXT_PUBLIC_APP_URL`
- Supabase：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Stripe：
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- AI：
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`（当前代码要求显式 GPT-4 系列，如 `gpt-4.1`）

## 3.2 可选但常用变量

- 邮件：`AUTH_EMAIL_SMTP_*`、`AUTH_EMAIL_FROM`
- INTL Google OAuth：
  - `SUPABASE_GOOGLE_OAUTH_MANAGED`
  - `SUPABASE_GOOGLE_OAUTH_CLIENT_ID`
  - `SUPABASE_GOOGLE_OAUTH_CLIENT_SECRET`
  - `SUPABASE_GOOGLE_OAUTH_CALLBACK_URL`
- CN 支付：
  - 微信支付：`WECHAT_PAY_*`
  - 支付宝：`ALIPAY_*`

INTL Google OAuth 细节见：[`docs/deployment/google-oauth-intl.md`](docs/deployment/google-oauth-intl.md)

## 3.3 密钥申请来源说明

- `Supabase`：项目设置里获取 URL、anon key、service role key
- `Stripe`：开发者后台获取 publishable key / secret key / webhook secret
- `OpenAI`：平台控制台创建 API Key
- `Tencent Cloud SMS`：短信服务控制台获取 AppID、签名、模板 ID 与密钥
- `CloudBase`：腾讯云开发（CloudBase）控制台获取环境 ID 与 API 密钥
- `WeChat Pay / Alipay`：各自商户平台申请商户号、应用 ID、API 密钥、证书/公钥

---

## 4. 构建与测试

```bash
# 代码检查
npm run lint

# 全量测试
npm test

# 主干回归用例
npm run test:mainline

# 区域一致性用例
npm run test:region-consistency

# 构建
npm run build
```

按区域构建：

```bash
npm run build:cn
npm run build:intl
```

生产启动：

```bash
npm run start
```

---

## 5. GitHub 复现建议流程（给协作者）

1. Fork / Clone 仓库
2. 按本 README 复制并填写 `.env.cn` 或 `.env.intl`
3. 运行对应数据库初始化脚本
4. 执行 `npm run dev:cn` 或 `npm run dev:intl`
5. 访问 `http://localhost:3000`，并根据需要创建 admin 账号

---

## 6. 安全与协作规范

- 不要在 Issue、PR、日志、截图中展示真实密钥
- 不要把 `.env.cn`、`.env.intl`、`.env.local` 提交到 Git
- 轮换泄露风险密钥（尤其是 `SUPABASE_SERVICE_ROLE_KEY`、`STRIPE_SECRET_KEY`、`OPENAI_API_KEY`）
- PR 前建议运行：`npm run lint && npm test`

---

## 7. 常见问题

### Q1：启动时报缺少环境变量

请先执行 `npm run env:cn` 或 `npm run env:intl`，确认 `.env.local` 已被正确切换，并检查对应必填项是否为空。

### Q2：INTL 迁移失败

确认：

- `NEXT_PUBLIC_SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 正确
- 需要远程推送时，已设置 `SUPABASE_ACCESS_TOKEN`
- 目标 Supabase 项目权限允许执行迁移

### Q3：支付回调不生效

优先检查 webhook 密钥、回调地址域名是否与当前环境一致（测试/生产不要混用）。

---

## License

MIT
