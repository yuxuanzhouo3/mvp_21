const APP_ID = 'cli_a9f147a9d878dbc4';
const APP_SECRET = 'fVoO7LxSgIvgSraCWf4M4bEBafU53OFV';

async function getFeishuToken() {
  const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      app_id: APP_ID,
      app_secret: APP_SECRET
    })
  });
  
  const data = await response.json();
  return data.tenant_access_token;
}

async function searchMessages() {
  try {
    const token = await getFeishuToken();
    console.log('🔍 正在搜索聊天记录...\n');
    
    // 搜索消息
    const response = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?container_id_type=chat', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      console.log('❌ API调用失败:', data);
      console.log('\n⚠️  可能原因:');
      console.log('1. 应用还没有"获取消息"的权限');
      console.log('2. 权限添加后需要重新发布应用版本');
      console.log('3. 应用需要被添加到聊天中');
      return;
    }
    
    console.log('✅ API调用成功！');
    console.log('返回数据:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

searchMessages();
