-- 创建企业资料表
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  credit_code TEXT NOT NULL,
  legal_person TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- 每个用户只能有一个企业资料
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON public.company_profiles(user_id);

-- 启用 RLS
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的企业资料
CREATE POLICY "Users can view own company profile"
  ON public.company_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：用户只能插入自己的企业资料
CREATE POLICY "Users can insert own company profile"
  ON public.company_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户只能更新自己的企业资料
CREATE POLICY "Users can update own company profile"
  ON public.company_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户只能删除自己的企业资料
CREATE POLICY "Users can delete own company profile"
  ON public.company_profiles
  FOR DELETE
  USING (auth.uid() = user_id);

-- 添加注释
COMMENT ON TABLE public.company_profiles IS '企业资料表，存储用户的企业信息（营业执照识别结果）';
COMMENT ON COLUMN public.company_profiles.user_id IS '用户ID（外键）';
COMMENT ON COLUMN public.company_profiles.company_name IS '公司名称';
COMMENT ON COLUMN public.company_profiles.credit_code IS '统一社会信用代码';
COMMENT ON COLUMN public.company_profiles.legal_person IS '法定代表人';
COMMENT ON COLUMN public.company_profiles.address IS '注册地址';
COMMENT ON COLUMN public.company_profiles.contact_person IS '联系人';
COMMENT ON COLUMN public.company_profiles.contact_phone IS '联系电话';
COMMENT ON COLUMN public.company_profiles.contact_email IS '联系邮箱';
