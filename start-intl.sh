#!/bin/bash
# 启动国际版 (INTL)

echo "🌍 启动 ContractHub 国际版..."
echo "📦 数据库: Supabase"
echo "💳 支付: Stripe + PayPal"
echo "🔐 认证: 邮箱 + Google OAuth"
echo ""

# 复制国际版环境变量
cp .env.intl .env.local

# 启动开发服务器
npm run dev
