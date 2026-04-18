BEGIN;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS contracts_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contracts_this_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE public.users
SET
  name = COALESCE(NULLIF(name, ''), NULLIF(nickname, ''), email),
  role = COALESCE(NULLIF(role, ''), 'user'),
  plan = COALESCE(NULLIF(plan, ''), NULLIF(subscription_type, ''), 'free'),
  status = COALESCE(NULLIF(status, ''), 'active')
WHERE TRUE;

ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE IF EXISTS public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'enterprise'));

ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE IF EXISTS public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'pro', 'enterprise'));

ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE IF EXISTS public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'suspended', 'deleted'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token
  ON public.user_sessions(token);

ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS source_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.contracts
SET
  type = COALESCE(NULLIF(type, ''), 'custom'),
  source_type = COALESCE(NULLIF(source_type, ''), 'text'),
  source_content = COALESCE(source_content, ''),
  ai_analysis = COALESCE(ai_analysis, '{}'::jsonb),
  metadata = COALESCE(metadata, '{}'::jsonb),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE TRUE;

ALTER TABLE IF EXISTS public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE IF EXISTS public.contracts
  ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('draft', 'pending', 'active', 'signed', 'completed', 'expired', 'cancelled'));

ALTER TABLE IF EXISTS public.contracts DROP CONSTRAINT IF EXISTS contracts_region_check;
ALTER TABLE IF EXISTS public.contracts
  ADD CONSTRAINT contracts_region_check
  CHECK (region IS NULL OR region IN ('CN', 'INTL', 'US', 'US-CN'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contracts'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contracts_updated_at'
  ) THEN
    CREATE TRIGGER update_contracts_updated_at
      BEFORE UPDATE ON public.contracts
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.contract_templates
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.contract_templates
SET
  description = COALESCE(description, ''),
  category = COALESCE(NULLIF(category, ''), NULLIF(type, ''), 'General'),
  status = COALESCE(NULLIF(status, ''), 'active'),
  version = COALESCE(version, 1),
  usage_count = COALESCE(usage_count, 0),
  updated_at = COALESCE(updated_at, created_at, NOW())
WHERE TRUE;

ALTER TABLE IF EXISTS public.contract_templates DROP CONSTRAINT IF EXISTS contract_templates_status_check;
ALTER TABLE IF EXISTS public.contract_templates
  ADD CONSTRAINT contract_templates_status_check
  CHECK (status IN ('active', 'draft', 'archived'));

CREATE INDEX IF NOT EXISTS idx_contract_templates_owner_status
  ON public.contract_templates(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contract_templates_lineage
  ON public.contract_templates(source_template_id, version DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contract_templates'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_contract_templates_updated_at'
  ) THEN
    CREATE TRIGGER update_contract_templates_updated_at
      BEFORE UPDATE ON public.contract_templates
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_admin_settings_updated_at
      BEFORE UPDATE ON public.admin_settings
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_payment_method_check;
ALTER TABLE IF EXISTS public.subscriptions
  ADD CONSTRAINT subscriptions_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('stripe', 'wechat', 'alipay'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_transaction_id
  ON public.subscriptions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON public.subscriptions(provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end
  ON public.subscriptions(current_period_end);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS order_id TEXT,
  ADD COLUMN IF NOT EXISTS out_trade_no TEXT,
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS code_url TEXT,
  ADD COLUMN IF NOT EXISTS client_type TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE IF EXISTS public.payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('stripe', 'wechat', 'alipay'));

CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id
  ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_out_trade_no
  ON public.payments(out_trade_no);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_payments_updated_at'
  ) THEN
    CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ad_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_id, date)
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id UUID NOT NULL,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  invited_by UUID,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT workspace_members_status_check CHECK (status IN ('active', 'invited', 'suspended'))
);

ALTER TABLE IF EXISTS public.workspace_members
  ADD COLUMN IF NOT EXISTS workspace_id UUID GENERATED ALWAYS AS (workspace_owner_id) STORED;

CREATE INDEX IF NOT EXISTS idx_workspace_members_owner
  ON public.workspace_members(workspace_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id
  ON public.workspace_members(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user
  ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_email
  ON public.workspace_members(email);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_members'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_workspace_members_updated_at'
  ) THEN
    CREATE TRIGGER update_workspace_members_updated_at
      BEFORE UPDATE ON public.workspace_members
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_owner_id UUID NOT NULL,
  member_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  invited_by UUID,
  accepted_by_user_id UUID,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT workspace_invites_role_check CHECK (role IN ('owner', 'admin', 'member')),
  CONSTRAINT workspace_invites_status_check CHECK (status IN ('pending', 'accepted', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_owner_created
  ON public.workspace_invites(workspace_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_owner_email_status
  ON public.workspace_invites(workspace_owner_id, email, status);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_member_status
  ON public.workspace_invites(member_id, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_invites'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_workspace_invites_updated_at'
  ) THEN
    CREATE TRIGGER update_workspace_invites_updated_at
      BEFORE UPDATE ON public.workspace_invites
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.workspace_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  group_name TEXT NOT NULL DEFAULT 'Workspace',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  hash TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'supabase',
  preview_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workspace_documents_storage_provider_check
    CHECK (storage_provider IN ('cloudbase', 'supabase'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_documents_user_updated
  ON public.workspace_documents(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_documents_user_category
  ON public.workspace_documents(user_id, category);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspace_documents'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_workspace_documents_updated_at'
  ) THEN
    CREATE TRIGGER update_workspace_documents_updated_at
      BEFORE UPDATE ON public.workspace_documents
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.document_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_id UUID NOT NULL,
  document_source_kind TEXT NOT NULL DEFAULT 'contract',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT document_share_links_source_kind_check
    CHECK (document_source_kind IN ('contract', 'uploaded'))
);

CREATE INDEX IF NOT EXISTS idx_document_share_links_user_document
  ON public.document_share_links(user_id, document_id, document_source_kind);
CREATE INDEX IF NOT EXISTS idx_document_share_links_token
  ON public.document_share_links(token);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_share_links'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_document_share_links_updated_at'
  ) THEN
    CREATE TRIGGER update_document_share_links_updated_at
      BEFORE UPDATE ON public.document_share_links
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  path TEXT,
  method TEXT,
  ip TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  severity TEXT NOT NULL DEFAULT 'info',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_audit_logs_status_check
    CHECK (status IN ('success', 'error', 'denied')),
  CONSTRAINT admin_audit_logs_severity_check
    CHECK (severity IN ('info', 'warn', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_user_id
  ON public.admin_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_status
  ON public.admin_audit_logs(status, created_at DESC);

ALTER TABLE IF EXISTS public.company_profiles
  DROP CONSTRAINT IF EXISTS company_profiles_user_id_key;

ALTER TABLE IF EXISTS public.company_profiles
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS ocr_status TEXT,
  ADD COLUMN IF NOT EXISTS license_file_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.company_profiles DROP CONSTRAINT IF EXISTS company_profiles_status_check;
ALTER TABLE IF EXISTS public.company_profiles
  ADD CONSTRAINT company_profiles_status_check
  CHECK (status IN ('active', 'archived'));

ALTER TABLE IF EXISTS public.company_profiles DROP CONSTRAINT IF EXISTS company_profiles_ocr_status_check;
ALTER TABLE IF EXISTS public.company_profiles
  ADD CONSTRAINT company_profiles_ocr_status_check
  CHECK (ocr_status IS NULL OR ocr_status IN ('pending', 'completed', 'failed'));

UPDATE public.company_profiles
SET is_default = TRUE
WHERE is_default = FALSE
  AND user_id IN (
    SELECT user_id
    FROM public.company_profiles
    GROUP BY user_id
    HAVING COUNT(*) = 1
  );

CREATE INDEX IF NOT EXISTS idx_company_profiles_user_updated
  ON public.company_profiles(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_default
  ON public.company_profiles(user_id, is_default DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_profiles_credit_code
  ON public.company_profiles(credit_code);

INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
