import cloudbase from '@cloudbase/node-sdk';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

const cloudbaseId = 'contracthub-2go0kvke215f83c1';
const secretId = process.env.CLOUDBASE_SECRET_ID;
const secretKey = process.env.CLOUDBASE_SECRET_KEY;

console.log('🚀 开始初始化 CloudBase 数据库\n');
console.log(`📍 环境ID: ${cloudbaseId}\n`);

if (!secretId || !secretKey) {
  console.error('❌ 缺少环境变量:');
  console.error('   CLOUDBASE_SECRET_ID:', secretId ? '✅' : '❌');
  console.error('   CLOUDBASE_SECRET_KEY:', secretKey ? '✅' : '❌');
  console.error('\n请在 .env.local 文件中配置这些变量');
  process.exit(1);
}

// 初始化 CloudBase
const app = cloudbase.init({
  env: cloudbaseId,
  secretId: secretId,
  secretKey: secretKey,
});

const db = app.database();

// 需要创建的集合（以代码实际使用的集合名为准）
const collections = [
  {
    name: 'web_users',
    description: '用户表（主表）',
    sampleDoc: {
      email: 'init@example.com',
      nickname: '初始化',
      subscription_plan: 'free',
      subscription_status: 'active',
      role: 'user',
      _init: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  },
  {
    name: 'contracts',
    description: '合同表',
    sampleDoc: {
      user_id: 'init',
      title: '初始化',
      type: 'purchase',
      status: 'draft',
      _init: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  },
  {
    name: 'subscriptions',
    description: '订阅表',
    sampleDoc: {
      user_id: 'init',
      plan: 'free',
      status: 'active',
      _init: true,
      created_at: new Date()
    }
  },
  {
    name: 'refresh_tokens',
    description: 'Refresh Token 表',
    sampleDoc: {
      userId: 'init',
      tokenId: 'init',
      isRevoked: false,
      _init: true,
      createdAt: new Date(),
      expiresAt: new Date()
    }
  },
  {
    name: 'security_logs',
    description: '安全日志表',
    sampleDoc: {
      event: 'init',
      _init: true,
      created_at: new Date()
    }
  },
  {
    name: 'ai_conversations',
    description: 'AI 对话记录表',
    sampleDoc: {
      user_id: 'init',
      _init: true,
      created_at: new Date()
    }
  },
  {
    name: 'payments',
    description: '支付记录表',
    sampleDoc: {
      user_id: 'init',
      order_no: 'INIT_' + Date.now(),
      status: 'pending',
      _init: true,
      created_at: new Date()
    }
  },
  {
    name: 'wechat_logins',
    description: '微信登录表',
    sampleDoc: {
      open_id: 'init',
      _init: true,
      created_at: new Date()
    }
  },
  {
    name: 'app_versions',
    description: '应用版本表',
    sampleDoc: {
      platform: 'web',
      version: '1.0.0',
      build_number: 1,
      is_active: true,
      _init: true,
      created_at: new Date()
    }
  }
];

async function checkAndCreateCollection(collectionName, description, sampleDoc) {
  try {
    console.log(`🔍 检查集合 "${collectionName}" (${description})...`);

    // 尝试查询集合
    const result = await db.collection(collectionName).limit(1).get();

    console.log(`   ✅ 集合 "${collectionName}" 已存在，共 ${result.data.length} 条记录\n`);
    return { exists: true, collection: collectionName };

  } catch (error) {
    if (error.code === 'DATABASE_COLLECTION_NOT_EXIST' || error.message?.includes('not exist')) {
      console.log(`   ⚠️  集合 "${collectionName}" 不存在`);
      console.log(`   🔨 尝试用 createCollection API 创建...`);

      try {
        // 使用 createCollection API 创建集合
        await db.createCollection(collectionName);
        console.log(`   ✅ 集合 "${collectionName}" 创建成功！\n`);
        return { exists: false, created: true, collection: collectionName };

      } catch (createError) {
        console.log(`   ❌ 创建失败: ${createError.message}\n`);
        return { exists: false, created: false, collection: collectionName, error: createError.message };
      }
    } else {
      console.log(`   ❌ 检查失败: ${error.message}\n`);
      return { exists: false, error: error.message };
    }
  }
}

async function initializeDatabase() {
  console.log('=' .repeat(60));
  console.log('开始检查和创建集合...\n');
  
  const results = {
    existing: [],
    created: [],
    failed: []
  };
  
  for (const collection of collections) {
    const result = await checkAndCreateCollection(
      collection.name,
      collection.description,
      collection.sampleDoc
    );
    
    if (result.exists) {
      results.existing.push(result.collection);
    } else if (result.created) {
      results.created.push(result.collection);
    } else {
      results.failed.push(result);
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('=' .repeat(60));
  console.log('\n📊 初始化结果：\n');
  
  if (results.existing.length > 0) {
    console.log(`✅ 已存在的集合 (${results.existing.length}):`);
    results.existing.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }
  
  if (results.created.length > 0) {
    console.log(`🎉 新创建的集合 (${results.created.length}):`);
    results.created.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log(`❌ 创建失败的集合 (${results.failed.length}):`);
    results.failed.forEach(item => {
      console.log(`   - ${item.collection}: ${item.error}`);
    });
    console.log('');
  }
  
  console.log('=' .repeat(60));
  
  if (results.failed.length === 0) {
    console.log('\n✅ 所有集合已准备就绪！数据库初始化完成！\n');
  } else {
    console.log('\n⚠️  部分集合创建失败，请查看上面的错误信息\n');
    console.log('💡 失败的集合可能需要在腾讯云控制台手动创建：');
    console.log('   https://console.cloud.tencent.com/tcb/db\n');
  }
}

// 运行初始化
initializeDatabase().catch(error => {
  console.error('❌ 初始化过程出错:', error);
  process.exit(1);
});
