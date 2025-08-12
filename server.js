const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('.')); // 允许访问静态文件
app.use(express.json());

// 读取数据
app.get('/data', (req, res) => {
  const filePath = path.join(__dirname, 'games.json');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.json([]);
    try { res.json(JSON.parse(data)); }
    catch (e) { res.json([]); }
  });
});

// 保存数据
app.post('/save', (req, res) => {
  const filePath = path.join(__dirname, 'games.json');
  const data = req.body;

  fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) return res.status(500).send('保存失败');
    res.send('✅ 保存成功');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 服务已启动：http://localhost:${PORT}`);
  console.log(`📁 打开：http://localhost:${PORT}/index.html`);
});
