# ContractHub - 快速启动指南

## 📦 已完成的工作

### ✅ 第一阶段：代码整合和环境配置 (已完成)

1. **模块整合**
   - ✅ 从 mvp_modules 复制了完整的支付API路由
   - ✅ 复制了微信登录和token刷新API
   - ✅ 更新了payment配置文件
   - ✅ Auth和Database模块已经存在且版本一致

2. **环境配置**
   - ✅ 创建了国际版配置文件：`.env.intl`
   - ✅ 创建了国内版配置文件：`.env.cn`
   - ✅ 默认使用国际版（测试环境更完整）

3. **数据库Schema**
   - ✅ Supabase数据库schema：`supabase-schema.sql`
   - ✅ CloudBase集合定义：`cloudbase-collections.json`

4. **启动脚本**
   - ✅ 国际版启动：`./start-intl.sh`
   - ✅ 国内版启动：`./start-cn.sh`

5. **签名证书**
   - ✅ 安卓签名证书：`contracthub.keystore`
   - 🔑 密码：`ContractHub2024`

---

## 🚀 快速启动

### 方式1：启动国际版（推荐）
```bash
./start-intl.sh
```

### 方式2：启动国内版
```bash
./start-cn.sh
```

### 方式3：手动启动
```bash
# 复制环境变量
cp .env.intl .env.local  # 或 cp .env.cn .env.local

# 安装依赖（如果还没安装）
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev
```

访问: http://localhost:3021

---

## 📋 环境变量说明

### 国际版 (.env.intl)
- ✅ **数据库**: Supabase (已配置)
- ✅ **支付**: Stripe + PayPal (测试环境)
- ✅ **认证**: 邮箱登录 + Google OAuth
- ⚠️ **AI**: 需要配置 OpenAI API Key

### 国内版 (.env.cn)
- ✅ **数据库**: CloudBase (已配置)
- ⚠️ **支付**: 支付宝 + 微信支付 (需要密钥)
- ⚠️ **认证**: 邮箱登录 + 微信登录 (微信需要密钥)
- ⚠️ **AI**: 需要配置通义千问 API Key

---

## 🗄️ 数据库配置

### Supabase (国际版)

1. 访问 Supabase 控制台: https://akffdzyqkbodxjjvwabt.supabase.co

2. 执行SQL文件创建表结构:
```sql
-- 复制 supabase-schema.sql 的内容
-- 在 Supabase Dashboard → SQL Editor 中执行
```

3. 配置RLS (行级安全)
   - 策略已在schema中定义
   - 确保在 Authentication → Policies 中验证

### CloudBase (国内版)

1. 访问腾讯云CloudBase控制台
   - 环境ID: `yuan-1-5g74k3ot0cb39649`

2. 创建集合(参考 cloudbase-collections.json):
   - users
   - contracts
   - orders
   - usage_logs
   - contract_templates
   - ads
   - app_versions

3. 配置索引
   - 按照JSON文件中的定义创建索引

---

## 🔑 需要申请的密钥

### 国际版

#### 1. OpenAI API Key
```bash
# 获取方式: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxx
```

#### 2. Google OAuth (可选)
```bash
# 获取方式: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
```

### 国内版

#### 1. 支付宝沙箱 (测试环境)
```bash
# 获取方式: https://openhome.alipay.com/develop/sandbox/app
ALIPAY_APP_ID=2021xxxxxxxxxx
ALIPAY_PRIVATE_KEY=MIIEvQxxxxxx
ALIPAY_ALIPAY_PUBLIC_KEY=MIIBIjxxxxxx
```

#### 2. 微信登录
```bash
# 获取方式: https://open.weixin.qq.com → 网站应用
NEXT_PUBLIC_WECHAT_APP_ID=wxxxxxxxxxxx
WECHAT_APP_SECRET=xxxxxxxxxxxxxxxx
```

#### 3. 微信支付 (需要企业资质)
```bash
# 获取方式: https://pay.weixin.qq.com
WECHAT_PAY_MCH_ID=1234567890
WECHAT_PAY_API_KEY=xxxxxxxxxxxxxxxx
```

#### 4. 通义千问 AI
```bash
# 获取方式: https://dashscope.aliyun.com
DASHSCOPE_API_KEY=sk-xxxxxxxxxx
```

---

## 📱 移动端打包

### 安卓App

#### 准备工作
```bash
# 安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 初始化 Capacitor
npx cap init ContractHub com.contracthub.cn

# 添加 Android 平台
npx cap add android
```

#### 打包国内版
```bash
# 1. 构建Web
npm run build

# 2. 同步到Android
npx cap sync

# 3. 打开 Android Studio
npx cap open android

# 4. 在 Android Studio 中:
#    - Build → Generate Signed Bundle/APK
#    - 选择 contracthub.keystore
#    - 密码: ContractHub2024
```

#### 打包国际版
```bash
# 修改包名为 com.contracthub.intl
# 移除微信/支付宝SDK
# 其他步骤同上
```

---

## 🔧 常见问题

### 1. 端口被占用
```bash
# 修改启动端口
npm run dev -- -p 3022
```

### 2. 依赖安装失败
```bash
# 使用 legacy-peer-deps
npm install --legacy-peer-deps

# 或清除缓存
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### 3. 构建错误
```bash
# 查看详细错误
npm run build 2>&1 | tee build.log

# TypeScript错误已在 next.config.mjs 中忽略
```

---

## 📁 项目结构

```
mvp21/
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   │   ├── auth/         # 认证API
│   │   ├── payment/      # 支付API (已整合)
│   │   ├── contracts/    # 合同API
│   │   └── admin/        # 后台API
│   ├── dashboard/        # 主应用
│   ├── admin/            # 后台管理
│   └── page.tsx          # 首页
├── lib/                   # 核心库
│   ├── auth/             # 认证模块
│   ├── payment/          # 支付模块
│   ├── database/         # 数据库适配器
│   └── ai/               # AI模块
├── components/           # 组件
├── .env.intl            # 国际版配置
├── .env.cn              # 国内版配置
├── .env.local           # 当前环境(默认国际版)
├── supabase-schema.sql  # 数据库Schema
├── cloudbase-collections.json  # CloudBase配置
├── contracthub.keystore # 安卓签名证书
├── start-intl.sh        # 启动国际版
└── start-cn.sh          # 启动国内版
```

---

## 📞 密钥获取帮助

如果你需要帮助获取任何密钥，参考：
1. `/Users/qinwenyan/Downloads/env(1).txt` - 详细的密钥获取说明
2. 或询问我，我会提供具体步骤

---

## ✅ 下一步

1. **测试国际版启动**: `./start-intl.sh`
2. **配置Supabase数据库**: 执行 `supabase-schema.sql`
3. **（可选）配置国内版密钥**: 编辑 `.env.cn`
4. **开始开发后台管理功能**
5. **打包移动端App**

---

**当前状态**: 
- ✅ 代码整合完成
- ✅ 环境配置完成
- 🔄 正在测试构建...
- ⏳ 等待数据库配置
- ⏳ 等待后台管理开发

**预计完成时间**: 2-3天
