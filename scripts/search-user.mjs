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

async function searchUsers() {
  try {
    const token = await getFeishuToken();
    console.log('✅ Token获取成功\n');
    
    // 搜索名为"冯昱玮"的用户
    console.log('🔍 搜索用户：冯昱玮...\n');
    
    const response = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emails: [], // 如果知道邮箱可以填入
        mobiles: [] // 如果知道手机号可以填入
      })
    });
    
    const data = await response.json();
    
    if (data.code === 0) {
      console.log('✅ API调用成功');
      console.log('结果:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ API调用失败:', data);
    }
    
    // 尝试搜索消息（需要知道chat_id）
    console.log('\n💡 提示：');
    console.log('飞书API限制，机器人只能访问它所在的聊天群组。');
    console.log('要查看与冯昱玮的聊天记录，需要：');
    console.log('1. 把机器人添加到你和冯昱玮的聊天中');
    console.log('2. 或者在聊天中@机器人');
    console.log('3. 或者把机器人添加到包含冯昱玮的群聊中');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

searchUsers();
