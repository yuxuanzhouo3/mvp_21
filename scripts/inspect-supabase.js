const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qwtdbswpenugyyfhbeaj.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dGRic3dwZW51Z3l5ZmhiZWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcyNzQxNSwiZXhwIjoyMDg1MzAzNDE1fQ.zc53_sxWtJLAtVDy-XtGfPs5xWIilfP-VKsQbneaQwE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectDatabase() {
  console.log('🔍 检查现有数据库结构...\n');

  // 检查已存在的表
  const tablesToCheck = ['users', 'contracts', 'contract_templates', 'ads'];

  for (const table of tablesToCheck) {
    console.log(`\n📋 表: ${table}`);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`   ❌ 错误: ${error.message}`);
        continue;
      }

      if (data && data.length > 0) {
        console.log(`   ✅ 记录数: 有数据`);
        console.log(`   📝 字段结构:`);
        Object.keys(data[0]).forEach(key => {
          const value = data[0][key];
          const type = typeof value;
          console.log(`      - ${key}: ${type} ${type === 'object' && value !== null ? '(JSON)' : ''}`);
        });
      } else {
        console.log(`   ✅ 表存在但无数据`);
      }
    } catch (error) {
      console.log(`   ❌ 无法访问: ${error.message}`);
    }
  }

  console.log('\n\n✨ 检查完成！');
  console.log('\n💡 建议:');
  console.log('   1. 您的数据库已经有一些表和数据');
  console.log('   2. 我会基于现有结构进行开发');
  console.log('   3. 不需要删除现有数据');
}

inspectDatabase().catch(error => {
  console.error('\n❌ 检查失败:', error);
  process.exit(1);
});
