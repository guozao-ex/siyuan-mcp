// Test encoding directly
const fetch = require('node-fetch');

async function testCreate() {
  const data = {
    notebook: '20260517160056-swrvy8t',
    path: '/直接测试.md',
    markdown: '# 中文标题\n\n中文内容测试'
  };
  
  console.log('发送数据:', JSON.stringify(data, null, 2));
  
  const response = await fetch('http://127.0.0.1:6806/api/filetree/createDocWithMd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  console.log('返回结果:', result);
}

testCreate().catch(console.error);
