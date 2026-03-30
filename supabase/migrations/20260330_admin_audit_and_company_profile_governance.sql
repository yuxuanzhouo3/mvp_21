CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
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

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_audit_logs IS 'Persistent admin audit events for backend access and management actions';

ALTER TABLE public.company_profiles
  DROP CONSTRAINT IF EXISTS company_profiles_user_id_key;

ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS ocr_status TEXT,
  ADD COLUMN IF NOT EXISTS license_file_url TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

ALTER TABLE public.company_profiles
  DROP CONSTRAINT IF EXISTS company_profiles_status_check;

ALTER TABLE public.company_profiles
  ADD CONSTRAINT company_profiles_status_check
    CHECK (status IN ('active', 'archived'));

ALTER TABLE public.company_profiles
  DROP CONSTRAINT IF EXISTS company_profiles_ocr_status_check;

ALTER TABLE public.company_profiles
  ADD CONSTRAINT company_profiles_ocr_status_check
    CHECK (ocr_status IS NULL OR ocr_status IN ('pending', 'completed', 'failed'));

UPDATE public.company_profiles
SET is_default = true
WHERE is_default = false
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

COMMENT ON TABLE public.company_profiles IS 'Company profiles with multi-entity support and OCR governance fields';
COMMENT ON COLUMN public.company_profiles.profile_name IS 'Optional display name for selecting among multiple company entities';
COMMENT ON COLUMN public.company_profiles.is_default IS 'Marks the default company profile for a user';
COMMENT ON COLUMN public.company_profiles.source IS 'Data source such as manual, ocr, import, or sync';
COMMENT ON COLUMN public.company_profiles.ocr_status IS 'OCR processing status';
COMMENT ON COLUMN public.company_profiles.license_file_url IS 'Business license file reference';
COMMENT ON COLUMN public.company_profiles.metadata IS 'Extended company profile metadata';
