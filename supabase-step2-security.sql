-- ==========================================
-- 第二步：启用 RLS 和创建安全策略
-- 注意：请先执行 step1-tables.sql
-- ==========================================

-- 启用行级安全
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 订阅表策略
-- ==========================================

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;
CREATE POLICY "Users can update own subscription" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 支付记录策略
-- ==========================================

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

-- ==========================================
-- 合同表策略
-- ==========================================

DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
CREATE POLICY "Users can view own contracts" ON contracts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own contracts" ON contracts;
CREATE POLICY "Users can create own contracts" ON contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
CREATE POLICY "Users can update own contracts" ON contracts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contracts" ON contracts;
CREATE POLICY "Users can delete own contracts" ON contracts
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 合同模板策略
-- ==========================================

DROP POLICY IF EXISTS "Public templates are viewable by everyone" ON contract_templates;
CREATE POLICY "Public templates are viewable by everyone" ON contract_templates
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own templates" ON contract_templates;
CREATE POLICY "Users can create own templates" ON contract_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON contract_templates;
CREATE POLICY "Users can update own templates" ON contract_templates
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON contract_templates;
CREATE POLICY "Users can delete own templates" ON contract_templates
  FOR DELETE USING (auth.uid() = user_id);
