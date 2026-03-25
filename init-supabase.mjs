import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少 Supabase 环境变量');
  process.exit(1);
}

// 从 Supabase URL 提取项目引用
const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ 错误: 无法解析 Supabase URL');
  process.exit(1);
}

console.log('🔧 正在连接到 Supabase PostgreSQL...');
console.log(`📍 项目: ${projectRef}`);

// 尝试不同的连接方式
const connectionStrings = [
  // 方式1: Transaction pooler (IPv6)
  `postgresql://postgres.${projectRef}:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  // 方式2: Direct connection
  `postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`,
  // 方式3: Session pooler
  `postgresql://postgres.${projectRef}:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
];

console.log('\n⚠️  需要数据库密码才能连接');
console.log('请按以下步骤获取数据库密码:\n');
console.log('1. 访问: https://supabase.com/dashboard/project/' + projectRef);
console.log('2. 点击左侧菜单 "Settings" → "Database"');
console.log('3. 在 "Connection string" 部分找到密码\n');
console.log('或者，您可以使用 Supabase 管理面板直接执行 SQL:\n');
console.log('1. 访问: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
console.log('2. 复制粘贴 supabase-schema.sql 的内容');
console.log('3. 点击 "RUN" 按钮执行\n');

// 尝试使用 Supabase REST API (Management API)
console.log('🔄 尝试使用 Supabase Management API...\n');

const { Client } = pg;

// 读取 SQL 文件
const sqlFilePath = path.join(__dirname, 'supabase-schema.sql');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

// 将SQL分解为独立的语句
const statements = sqlContent
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0)
  .filter(s => !s.startsWith('--'))
  .map(s => s + ';');

console.log(`📄 已读取 ${statements.length} 条 SQL 语句\n`);
console.log('请选择执行方式:\n');
console.log('方式A: 手动执行（推荐）');
console.log('  1. 访问: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
console.log('  2. 复制 supabase-schema.sql 的全部内容');
console.log('  3. 粘贴到 SQL Editor');
console.log('  4. 点击 "RUN" 执行\n');
console.log('方式B: 提供数据库密码，让脚本自动执行');
console.log('  设置环境变量: SUPABASE_DB_PASSWORD=你的数据库密码');
console.log('  然后重新运行此脚本\n');

// 如果提供了数据库密码，尝试自动执行
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (dbPassword) {
  console.log('🔑 检测到数据库密码，尝试自动执行...\n');
  
  const connectionString = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ 已连接到数据库\n');
    console.log('⚡ 开始执行数据库初始化...\n');

    await client.query(sqlContent);

    console.log('\n🎉 数据库初始化完成！');
    console.log('\n✅ 已创建的表:');
    console.log('   - users (用户表)');
    console.log('   - contracts (合同表)');
    console.log('   - orders (订单表)');
    console.log('   - usage_logs (使用日志表)');
    console.log('   - contract_templates (合同模板表)');
    console.log('   - ads (广告位表)');
    console.log('   - app_versions (应用版本表)');

  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    console.error('\n请使用方式A手动执行');
  } finally {
    await client.end();
  }
} else {
  console.log('💡 建议: 使用方式A手动执行最为简单可靠！');
}
