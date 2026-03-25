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
    console.log('✅ Token获取成功\n');
    
    // 1. 获取机器人所在的聊天列表
    console.log('🔍 获取机器人所在的聊天列表...\n');
    
    const chatsResponse = await fetch('https://open.feishu.cn/open-apis/im/v1/chats?page_size=50', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const chatsData = await chatsResponse.json();
    
    if (chatsData.code !== 0) {
      console.log('❌ 获取聊天列表失败:', chatsData);
      return;
    }
    
    console.log(`✅ 找到 ${chatsData.data.items.length} 个聊天\n`);
    
    // 2. 在每个聊天中搜索包含"腾讯云"的消息
    for (const chat of chatsData.data.items) {
      console.log(`📝 检查聊天: ${chat.name || chat.chat_id}...`);
      
      // 获取聊天消息
      const messagesResponse = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages?container_id_type=chat&container_id=${chat.chat_id}&page_size=50`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const messagesData = await messagesResponse.json();
      
      if (messagesData.code === 0 && messagesData.data.items) {
        // 搜索包含"腾讯云"的消息
        const relevantMessages = messagesData.data.items.filter(msg => {
          try {
            const content = JSON.parse(msg.body.content);
            const text = content.text || '';
            return text.includes('腾讯云') || text.includes('账号') || text.includes('密码') || text.includes('冯昱玮');
          } catch {
            return false;
          }
        });
        
        if (relevantMessages.length > 0) {
          console.log(`\n✅ 在 "${chat.name || chat.chat_id}" 中找到 ${relevantMessages.length} 条相关消息：\n`);
          
          for (const msg of relevantMessages) {
            try {
              const content = JSON.parse(msg.body.content);
              console.log('---');
              console.log(`时间: ${new Date(parseInt(msg.create_time)).toLocaleString('zh-CN')}`);
              console.log(`消息ID: ${msg.message_id}`);
              console.log(`内容: ${content.text}`);
              console.log('---\n');
            } catch (e) {
              console.log(`解析消息失败: ${msg.message_id}`);
            }
          }
        }
      }
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n✅ 搜索完成！');
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error);
  }
}

searchMessages();
