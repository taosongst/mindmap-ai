# MindMap AI Sync Chrome Extension

手动同步 ChatGPT 对话到 MindMap AI 应用。

## 安装步骤

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的 "开发者模式"
3. 点击 "加载已解压的扩展程序"
4. 选择 `chrome-extension` 文件夹

## 使用方法

1. 确保 MindMap AI 在 localhost:3000 运行（`npm run dev`）
2. 打开 ChatGPT (chatgpt.com) 并进入一个对话
3. 点击扩展图标，查看对话信息（标题、问答数量）
4. 点击"同步到 MindMap AI"按钮
5. 同步完成后可点击"打开 MindMap AI"查看

## 功能特性

- 显示当前对话标题和问答数量
- 手动点击同步，不会自动同步
- 增量同步，已同步的问答不会重复创建
- 同步后可直接跳转到对应地图

## 故障排除

### 扩展无法连接

- 确保 MindMap AI 在 localhost:3000 运行
- 检查是否有防火墙阻止本地连接

### 问答数量为 0

- 确保对话中有完整的问答（用户提问 + AI 回复）
- 刷新 ChatGPT 页面后重试

### DOM 选择器失效

ChatGPT 可能会更新页面结构，如果同步失效：
1. 打开 ChatGPT 页面
2. 按 F12 打开开发者工具
3. 检查消息元素的属性
4. 更新 `content.js` 中的选择器
