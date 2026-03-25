-- ContractHub 数据库表结构
-- 国际版 (Supabase/PostgreSQL)

-- ========================================
-- 1. 用户表
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'enterprise')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  
  -- 统计数据
  contracts_count INTEGER DEFAULT 0,
  contracts_this_month INTEGER DEFAULT 0,
  
  -- 时间戳
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 2. 用户会话表
-- ========================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 3. 合同表
-- ========================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 合同基本信息
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'completed', 'cancelled')),
  region TEXT CHECK (region IN ('US', 'CN', 'US-CN')),
  
  -- 合同参与方
  parties JSONB DEFAULT '[]'::jsonb, -- 存储参与方数组 [{"name": "张三", "email": "..."}, ...]
  
  -- 签名信息
  signatures JSONB DEFAULT '[]'::jsonb, -- 存储签名数组
  
  -- 元数据
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- 时间戳
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 4. 合同模板表
-- ========================================
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  content TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 5. 订阅表
-- ========================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  
  -- 定价信息
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'annual')),
  
  -- 支付方式
  payment_method TEXT CHECK (payment_method IN ('stripe', 'paypal')),
  
  -- 日期
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_bill_date TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 6. 支付记录表
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- 支付信息
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'paypal')),
  
  -- 外部支付 ID
  external_payment_id TEXT,
  
  -- 元数据
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 7. 广告位表
-- ========================================
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT NOT NULL, -- 'banner_top', 'sidebar', 'footer' 等
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'html')),
  content TEXT NOT NULL, -- URL 或 HTML 内容
  link TEXT,
  
  -- 状态和统计
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  
  -- 日期范围
  start_date DATE,
  end_date DATE,
  
  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 8. 广告统计表
-- ========================================
CREATE TABLE IF NOT EXISTS ad_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(ad_id, date)
);

-- ========================================
-- 索引
-- ========================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

-- ========================================
-- 自动更新 updated_at 触发器
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_templates_updated_at BEFORE UPDATE ON contract_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON ads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 初始数据
-- ========================================

-- 插入默认合同模板
INSERT INTO contract_templates (name, description, category, content, is_public) VALUES
('Service Agreement', 'Standard service agreement for B2B transactions', 'Business', 'Service Agreement template content here...', true),
('Non-Disclosure Agreement', 'NDA for protecting confidential information', 'Legal', 'NDA template content here...', true),
('Employment Contract', 'Standard employment agreement template', 'HR', 'Employment Contract template content here...', true),
('Partnership Agreement', 'Template for business partnership agreements', 'Business', 'Partnership Agreement template content here...', true);

-- 插入测试用户 (开发环境)
INSERT INTO users (id, email, name, role, plan, status) VALUES
('00000000-0000-0000-0000-000000000001', 'test@contracthub.com', 'Test User', 'user', 'pro', 'active');
