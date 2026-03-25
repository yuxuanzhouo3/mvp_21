const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qwtdbswpenugyyfhbeaj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dGRic3dwZW51Z3l5ZmhiZWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyNzQxNSwiZXhwIjoyMDg1MzAzNDE1fQ.zc53_sxWtJLAtVDy-XtGfPs5xWIilfP-VKsQbneaQwE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDatabase() {
  console.log('🔍 验证 Supabase 数据库结构...\n');

  const tables = [
    'users',
    'user_sessions', 
    'contracts',
    'contract_templates',
    'subscriptions',
    'payments',
    'ads',
    'ad_stats'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (error) throw error;

      console.log(`✅ 表 "${table}" - 记录数: ${count || 0}`);
      if (data && data.length > 0) {
        console.log(`   示例数据: ${JSON.stringify(data[0], null, 2).substring(0, 200)}...\n`);
      }
    } catch (error) {
      console.log(`❌ 表 "${table}" 验证失败: ${error.message}\n`);
    }
  }

  // 测试插入一条用户记录
  console.log('\n📝 测试插入测试用户...');
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: 'test@contracthub.com',
        name: 'Test User',
        role: 'user',
        plan: 'free',
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log('⚠️  测试用户已存在（这是正常的）');
      } else {
        throw error;
      }
    } else {
      console.log('✅ 成功插入测试用户:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ 插入测试用户失败:', error.message);
  }

  console.log('\n✨ 数据库验证完成！');
}

verifyDatabase().catch(error => {
  console.error('\n❌ 验证失败:', error);
  process.exit(1);
});
