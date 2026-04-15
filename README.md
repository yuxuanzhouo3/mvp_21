# MornContract

MornContract 是一个基于 Next.js App Router 的数字合同平台，支持合同创建、分析、签署、导出、团队协作、文档验真与订阅支付。  
项目采用 **CN / INTL 双区域架构**，同一套代码根据环境变量自动切换认证、数据库与支付能力。

## 核心能力

- 合同全流程：创建、编辑、AI 辅助分析/生成、签署、导出（PDF/Word/HTML）
- 工作台与团队：Dashboard、模板管理、成员邀请、文档库、账单页
- 多支付接入：微信支付、支付宝、Stripe（含 webhook 与状态同步）
- 区域分流：按部署区域切换认证/数据库/支付通道
- 安全治理：认证保护、中间件校验、CSRF、防刷、运行时配置校验
- 可观测性：业务链路日志、关键流程治理测试

## 区域双栈设计

当前部署配置（`lib/config/deployment.config.ts`）：

- `CN`
  - 认证：CloudBase（邮箱/手机验证码等）
  - 数据库：CloudBase
  - 支付：WeChat Pay、Alipay
- `INTL`
  - 认证：Supabase
  - 数据库：Supabase
  - 支付：Stripe（当前配置主通道）

> 区域由以下变量决定：`NEXT_PUBLIC_APP_REGION` / `APP_REGION` / `NEXT_PUBLIC_DEPLOYMENT_REGION`。

## 技术栈

- Next.js 15 + React 19 + TypeScript
- Tailwind CSS + Radix UI
- Supabase / CloudBase 双数据层
- Stripe / WeChat / Alipay / PayPal（代码层）
- Jest + ts-jest（核心治理与回归测试）

## 快速开始

### 1) 环境要求

- Node.js 20+
- npm 10+

### 2) 安装依赖

```bash
npm install
```

### 3) 初始化环境文件

```powershell
Copy-Item .env.cn.example .env.cn
Copy-Item .env.intl.example .env.intl
```

> `scripts/use-env.mjs` 会把目标环境复制到 `.env.local`。  
> 每次切换区域都会覆盖 `.env.local`。

### 4) 启动开发环境

```bash
# CN（默认）
npm run dev:cn

# INTL
npm run dev:intl
```

也可只切换环境而不启动：

```bash
npm run env:cn
npm run env:intl
```

## 常用命令

```bash
# 开发
npm run dev
npm run dev:cn
npm run dev:intl

# 构建
npm run build
npm run build:cn
npm run build:intl

# 质量检查
npm run lint
npm test
npm run test:mainline
npm run test:region-consistency
npm run test:release-gate

# 区域数据初始化 / 迁移
npm run db:workspace:cn
npm run db:workspace:intl
npm run db:workspace:rollout
```

## 关键环境变量（最小集）

### CN

- 区域与域名：`APP_REGION=CN`、`NEXT_PUBLIC_APP_REGION=CN`、`APP_URL`
- CloudBase：`NEXT_PUBLIC_WECHAT_CLOUDBASE_ID`、`CLOUDBASE_SECRET_ID`、`CLOUDBASE_SECRET_KEY`
- 鉴权：`JWT_SECRET`
- 微信支付：`WECHAT_PAY_MCH_ID`、`WECHAT_PAY_API_V3_KEY`、`WECHAT_PAY_SERIAL_NO`、`WECHAT_PAY_PRIVATE_KEY`、`WECHAT_PAY_PLATFORM_PUBLIC_KEY`
- 支付宝：`ALIPAY_APP_ID`、`ALIPAY_PRIVATE_KEY`、`ALIPAY_ALIPAY_PUBLIC_KEY`
- AI：`DASHSCOPE_API_KEY`

### INTL

- 区域与域名：`APP_REGION=INTL`、`NEXT_PUBLIC_APP_REGION=INTL`、`APP_URL`
- Supabase：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
- 鉴权：`JWT_SECRET`
- Stripe：`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`
- AI：`OPENAI_API_KEY`

## 项目结构

```text
app/                   # 页面与 API 路由（App Router）
  api/                 # 按业务域拆分的服务端接口
components/            # 业务组件与 UI 组件
lib/                   # 业务核心（auth/payment/contracts/dashboard/security/...）
supabase/              # SQL schema 与 migrations
scripts/               # 环境切换、迁移、初始化脚本
tests/                 # 治理主线与回归测试
docs/qa/               # 回归矩阵与流程文档
```

## API 模块概览

`app/api` 当前主要分组：

- `auth`：登录、注册、刷新、会话与找回流程
- `contracts`：合同 CRUD、分析、生成、导出
- `dashboard`：概览、模板、团队、文档、账单
- `payment`：创建、确认、状态、webhook、一次性支付
- `admin`：管理端用户、版本、分析、订阅、审计
- `public` / `team-invites`：公开验真与邀请相关接口

## 质量与发布建议

- 本地最小发布门禁：`npm run lint && npm run test:release-gate && npm run build`
- 区域一致性发布门禁：额外执行 `npm run test:region-consistency`
- 回归矩阵参考：`docs/qa/region-dual-stack-regression-matrix.md`

## 已知约束

- `middleware.ts` 对受保护路由会做登录校验与角色判断。
- 部分地区访问策略由中间件与地理检测逻辑控制。
- 线上必须完整配置区域对应的鉴权、数据库、支付密钥（尤其微信平台公钥与 Stripe webhook secret）。

## License

MIT
