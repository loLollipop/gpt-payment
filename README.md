# gpt-payment

一个简单的网页工具：输入 ChatGPT 支付长链接，提取对应短链接。

## 本地使用

1. 打开 `index.html`。
2. 粘贴支付长链接（例如包含 `checkout_session_id` / `session_id` 参数）。
3. 点击 **提取短链接**。
4. 可点击 **复制结果**。

短链接格式：

```text
https://chatgpt.com/checkout/{processor}/{checkout_session_id}
```

默认 `processor` 为 `openai_llc`（当原始链接未提供时）。

## 部署到 Zeabur

仓库已包含 `server.js`、`package.json`、`zeabur.json`，可直接在 Zeabur 通过 Node 服务部署。

### 步骤

1. 将仓库推送到 GitHub。
2. 登录 Zeabur，点击 **New Project**。
3. 选择该 GitHub 仓库并导入。
4. Runtime 选择 **Node.js**（通常会自动识别）。
5. Zeabur 会自动执行启动命令：`npm start`。
6. 部署完成后，打开分配的域名即可使用。

### 启动与端口说明

- 服务会读取 Zeabur 提供的 `PORT` 环境变量。
- 根路径 `/` 默认返回 `index.html`。
