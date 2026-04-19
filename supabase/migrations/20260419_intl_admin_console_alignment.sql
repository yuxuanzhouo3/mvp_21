BEGIN;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admins_role_check CHECK (role IN ('admin', 'super_admin')),
  CONSTRAINT admins_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON public.admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_status ON public.admins(status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admins_updated_at') THEN
    CREATE TRIGGER update_admins_updated_at
      BEFORE UPDATE ON public.admins
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT system_logs_status_check CHECK (status IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at
  ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_admin_created_at
  ON public.system_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_action_created_at
  ON public.system_logs(action, created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT system_config_category_check
    CHECK (category IN ('general', 'payment', 'ai', 'storage', 'security', 'notification'))
);

CREATE INDEX IF NOT EXISTS idx_system_config_category ON public.system_config(category);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'stripe',
  status TEXT NOT NULL DEFAULT 'pending',
  product_type TEXT,
  product_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS user_email TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method_created_at
  ON public.orders(payment_method, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
    CREATE TRIGGER update_orders_updated_at
      BEFORE UPDATE ON public.orders
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    INSERT INTO public.orders (
      id, user_id, amount, currency, payment_method, status, product_type, product_id, created_at, updated_at, completed_at
    )
    SELECT
      p.id,
      p.user_id,
      COALESCE(p.amount, 0),
      COALESCE(NULLIF(p.currency, ''), 'USD'),
      COALESCE(NULLIF(p.payment_method, ''), 'stripe'),
      COALESCE(NULLIF(p.status, ''), 'pending'),
      NULLIF(p.product_type, ''),
      NULLIF(p.plan_id, ''),
      COALESCE(p.created_at, NOW()),
      COALESCE(p.updated_at, p.created_at, NOW()),
      p.completed_at
    FROM public.payments p
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'image',
  position TEXT NOT NULL DEFAULT 'top',
  file_url TEXT,
  image_url TEXT,
  file_url_cn TEXT,
  file_url_intl TEXT,
  link_url TEXT,
  redirect_url TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  file_size BIGINT,
  start_date DATE,
  end_date DATE,
  impression_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT advertisements_type_check CHECK (type IN ('image', 'video')),
  CONSTRAINT advertisements_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_advertisements_status_created_at
  ON public.advertisements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advertisements_position_created_at
  ON public.advertisements(position, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advertisements_priority_created_at
  ON public.advertisements(priority DESC, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_advertisements_updated_at') THEN
    CREATE TRIGGER update_advertisements_updated_at
      BEFORE UPDATE ON public.advertisements
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- NOTE:
-- Do not backfill from legacy `ads` automatically because field naming differs across
-- historical environments and may break migration execution.

CREATE TABLE IF NOT EXISTS public.social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_links_order ON public.social_links("order");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_social_links_updated_at') THEN
    CREATE TRIGGER update_social_links_updated_at
      BEFORE UPDATE ON public.social_links
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  variant TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  release_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_releases_platform_variant_created
  ON public.releases(platform, variant, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_releases_is_active_created
  ON public.releases(is_active, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_releases_updated_at') THEN
    CREATE TRIGGER update_releases_updated_at
      BEFORE UPDATE ON public.releases
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('admin-files', 'admin-files', true),
  ('releases', 'releases', true),
  ('social-icons', 'social-icons', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
