import express from 'express';

const app = express();

// 测试不同的 body parser 配置
app.use(express.json({ limit: '10mb' }));

app.post('/test', (req, res) => {
  console.log('收到的 body:', req.body);
  console.log('title 类型:', typeof req.body.title);
  console.log('title 长度:', req.body.title?.length);
  console.log('title hex:', Buffer.from(req.body.title || '', 'utf8').toString('hex').substring(0, 50));
  
  res.json({ received: req.body });
});

app.listen(3001, () => {
  console.log('测试服务器启动在 3001');
});
