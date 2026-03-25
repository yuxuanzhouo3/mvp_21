const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase 配置
const supabaseUrl = 'https://qwtdbswpenugyyfhbeaj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dGRic3dwZW51Z3l5ZmhiZWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyNzQxNSwiZXhwIjoyMDg1MzAzNDE1fQ.zc53_sxWtJLAtVDy-XtGfPs5xWIilfP-VKsQbneaQwE';

// 创建 Supabase 客户端（使用 service role key 以获得完整权限）
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🚀 开始初始化 Supabase 数据库...\n');

  // 读取 SQL 文件
  const sqlPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // 分割 SQL 语句（按 ; 分隔，但要处理函数中的分号）
  const statements = sqlContent
    .split(/;\s*(?=CREATE|INSERT|ALTER|DROP|--)/gi)
    .filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim();
    if (!statement) continue;

    try {
      console.log(`📝 执行语句 ${i + 1}/${statements.length}...`);
      
      // 使用 rpc 调用执行 SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      }).catch(async () => {
        // 如果 rpc 不存在，尝试直接通过 REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ query: statement + ';' })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        return { data: await response.json(), error: null };
      });

      if (error) {
        throw error;
      }

      console.log(`✅ 成功执行\n`);
      successCount++;
    } catch (error) {
      console.error(`❌ 执行失败:`);
      console.error(`   SQL: ${statement.substring(0, 100)}...`);
      console.error(`   错误: ${error.message}\n`);
      errorCount++;
      
      // 如果是创建表相关的错误，可能是因为表已存在，继续执行
      if (!error.message.includes('already exists')) {
        // 对于非"已存在"的错误，停止执行
        // throw error;
      }
    }
  }

  console.log('\n📊 执行结果统计:');
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ❌ 失败: ${errorCount}`);
  console.log(`   📝 总计: ${statements.length}`);

  // 验证表是否创建成功
  console.log('\n🔍 验证数据库表...');
  
  const tables = ['users', 'contracts', 'subscriptions', 'payments', 'ads'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      
      console.log(`   ✅ 表 "${table}" 存在`);
    } catch (error) {
      console.log(`   ❌ 表 "${table}" 不存在或无法访问: ${error.message}`);
    }
  }

  console.log('\n✨ 数据库初始化完成！');
}

// 执行
setupDatabase().catch(error => {
  console.error('\n❌ 数据库初始化失败:', error);
  process.exit(1);
});
