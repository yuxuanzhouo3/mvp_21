#!/bin/bash
# 启动国内版 (CN)

echo "🇨🇳 启动 ContractHub 国内版..."
echo "📦 数据库: CloudBase (腾讯云)"
echo "💳 支付: 暂时禁用 (等待密钥)"
echo "🔐 认证: 邮箱登录"
echo ""

# 复制国内版环境变量
cp .env.cn .env.local

# 启动开发服务器
npm run dev
