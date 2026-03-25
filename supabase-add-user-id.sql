-- 为现有表添加 user_id 字段（如果不存在）

-- 1. 为 contracts 表添加 user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE contracts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    -- 如果表中已有数据，可能需要设置默认值或手动更新
    RAISE NOTICE 'Added user_id column to contracts table';
  ELSE
    RAISE NOTICE 'contracts.user_id already exists';
  END IF;
END $$;

-- 2. 为 contract_templates 表添加 user_id（已在之前的脚本中添加）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_templates' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE contract_templates ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added user_id column to contract_templates table';
  ELSE
    RAISE NOTICE 'contract_templates.user_id already exists';
  END IF;
END $$;

-- 3. 检查 subscriptions 表是否有 user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'subscriptions' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE subscriptions ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added user_id column to subscriptions table';
    ELSE
      RAISE NOTICE 'subscriptions.user_id already exists';
    END IF;
  ELSE
    RAISE NOTICE 'subscriptions table does not exist';
  END IF;
END $$;

-- 4. 检查 payments 表是否有 user_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'payments' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE payments ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE 'Added user_id column to payments table';
    ELSE
      RAISE NOTICE 'payments.user_id already exists';
    END IF;
  ELSE
    RAISE NOTICE 'payments table does not exist';
  END IF;
END $$;
