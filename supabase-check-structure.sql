-- 检查现有表的结构
-- 请执行这个查询，然后把结果告诉我

-- 检查 contracts 表的列
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contracts'
ORDER BY ordinal_position;

-- 检查 contract_templates 表的列
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contract_templates'
ORDER BY ordinal_position;

-- 检查 subscriptions 表的列（如果存在）
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 检查 payments 表的列（如果存在）
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;

-- 检查 profiles 表的列（如果存在）
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
