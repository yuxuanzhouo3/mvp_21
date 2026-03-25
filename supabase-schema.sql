-- ==========================================
-- ContractHub 国际版数据库Schema
-- 数据库: Supabase (PostgreSQL)
-- ==========================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. 用户表 (users)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255),
  nickname VARCHAR(100) NOT NULL,
  avatar VARCHAR(500),
  subscription_type VARCHAR(20) DEFAULT 'free' CHECK (subscription_type IN ('free', 'pro', 'enterprise')),
  subscription_expire_at TIMESTAMP,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription_type ON users(subscription_type);

-- ==========================================
-- 2. 合同表 (contracts)
-- ==========================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('labor', 'service', 'cooperation', 'nda', 'custom')),
  content JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'signed', 'expired')),
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('text', 'screenshot', 'wechat')),
  source_content TEXT,
  ai_analysis JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 合同表索引
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(type);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at DESC);

-- ==========================================
-- 3. 支付订单表 (orders)
-- ==========================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  plan_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD' CHECK (currency IN ('USD', 'CNY')),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('stripe', 'paypal', 'alipay', 'wechat')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_id VARCHAR(255),
  paid_at TIMESTAMP,
  expire_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 订单表索引
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ==========================================
-- 4. 使用日志表 (usage_logs)
-- ==========================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  device_type VARCHAR(50),
  device_model VARCHAR(100),
  os_version VARCHAR(50),
  app_version VARCHAR(20),
  ip VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 使用日志索引
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at DESC);

-- ==========================================
-- 5. 合同模板表 (contract_templates)
-- ==========================================
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 模板表索引
CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON contract_templates(type);

-- ==========================================
-- 6. 广告位表 (ads)
-- ==========================================
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position VARCHAR(50) NOT NULL CHECK (position IN ('splash', 'banner', 'interstitial')),
  title VARCHAR(100),
  image_url VARCHAR(500),
  link_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  start_at TIMESTAMP,
  end_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 广告位索引
CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);
CREATE INDEX IF NOT EXISTS idx_ads_is_active ON ads(is_active);

-- ==========================================
-- 7. 应用版本表 (app_versions)
-- ==========================================
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('android', 'ios', 'mac', 'windows', 'harmonyos')),
  version VARCHAR(20) NOT NULL,
  build_number INTEGER NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size BIGINT,
  changelog TEXT,
  force_update BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 版本表索引
CREATE INDEX IF NOT EXISTS idx_app_versions_platform ON app_versions(platform);
CREATE INDEX IF NOT EXISTS idx_app_versions_is_active ON app_versions(is_active);

-- ==========================================
-- 8. 更新 updated_at 触发器
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表创建触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 9. 行级安全策略 (RLS)
-- ==========================================

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 用户只能读取自己的数据
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

-- 用户只能更新自己的数据
CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);

-- 用户只能读取自己的合同
CREATE POLICY contracts_select_own ON contracts
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能插入自己的合同
CREATE POLICY contracts_insert_own ON contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的合同
CREATE POLICY contracts_update_own ON contracts
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的合同
CREATE POLICY contracts_delete_own ON contracts
  FOR DELETE USING (auth.uid() = user_id);

-- 用户只能读取自己的订单
CREATE POLICY orders_select_own ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- ==========================================
-- 10. 插入初始数据
-- ==========================================

-- 插入默认合同模板
INSERT INTO contract_templates (name, type, content, is_default) VALUES
  ('劳动合同模板', 'labor', '{"sections": []}', true),
  ('劳务协议模板', 'service', '{"sections": []}', true),
  ('合作协议模板', 'cooperation', '{"sections": []}', true),
  ('保密协议模板', 'nda', '{"sections": []}', true)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Schema创建完成
-- ==========================================
