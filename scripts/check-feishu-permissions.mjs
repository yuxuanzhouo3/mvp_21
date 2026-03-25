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

async function getUserInfo() {
  try {
    const token = await getFeishuToken();
    console.log('✅ Token获取成功\n');
    
    // 获取当前应用的权限信息
    console.log('🔍 检查应用权限...\n');
    
    const response = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('当前用户信息:', JSON.stringify(data, null, 2));
    
    // 尝试获取聊天列表
    console.log('\n🔍 尝试获取聊天列表...\n');
    const chatResponse = await fetch('https://open.feishu.cn/open-apis/im/v1/chats?page_size=20', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const chatData = await chatResponse.json();
    
    if (chatData.code === 0) {
      console.log('✅ 成功获取聊天列表！');
      console.log('聊天数量:', chatData.data?.items?.length || 0);
      
      if (chatData.data?.items && chatData.data.items.length > 0) {
        console.log('\n聊天列表:');
        chatData.data.items.forEach((chat, index) => {
          console.log(`${index + 1}. ${chat.name || '未命名'} (ID: ${chat.chat_id})`);
        });
      }
    } else {
      console.log('❌ 获取聊天列表失败:', chatData);
      console.log('\n💡 提示:');
      console.log('1. 请确认已添加权限: im:chat, im:chat:readonly');
      console.log('2. 添加权限后需要重新发布应用版本');
      console.log('3. 发布后等待几分钟让权限生效');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

getUserInfo();
