import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 环境变量');
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createCompanyProfilesTable() {
  try {
    console.log('📦 正在创建 company_profiles 表...');

    // 读取 SQL 文件
    const sqlPath = join(__dirname, '../supabase/migrations/20260204_create_company_profiles.sql');
    const sql = readFileSync(sqlPath, 'utf-8');

    // 执行 SQL（需要使用 RPC 或直接 SQL 执行）
    // 注意：Supabase JS 客户端不直接支持执行原始 SQL
    // 需要在 Supabase Dashboard 的 SQL Editor 中执行

    console.log('⚠️  请在 Supabase Dashboard 中执行以下 SQL:');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    console.log('\n📍 步骤:');
    console.log('1. 访问 https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0]);
    console.log('2. 点击左侧菜单 "SQL Editor"');
    console.log('3. 点击 "New query"');
    console.log('4. 复制上面的 SQL 并粘贴');
    console.log('5. 点击 "Run" 执行');
    console.log('\n✅ 或者直接执行以下命令查看 SQL:');
    console.log('cat supabase/migrations/20260204_create_company_profiles.sql');

  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

createCompanyProfilesTable();
