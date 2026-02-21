# gpt-payment

一个简单的网页工具：输入 ChatGPT 支付长链接，提取对应短链接。

另外支持使用 `access token` 直接请求 `POST /backend-api/payments/checkout` 并返回短链接（服务端代发请求）。

## 本地使用

1. 打开 `index.html`。
2. 粘贴支付长链接（例如包含 `checkout_session_id` / `session_id` 参数）。
3. 点击 **提取短链接**（或在输入框按 `Ctrl/Cmd + Enter`）。
4. 可点击 **复制结果**。

短链接格式：

```text
https://chatgpt.com/checkout/{processor}/{checkout_session_id}
```

默认 `processor` 为 `openai_llc`（当原始链接未提供时）。

## Access token 直连 checkout（对齐 XHR 思路）

项目内置接口：`POST /api/checkout-link`

请求体示例：

```json
{
  "accessToken": "Bearer eyJ...",
  "planType": "plus",
  "options": {
    "referral_code": "",
    "promo_campaign_id": "plus-1-month-free"
  }
}
```

说明：

- `planType` 支持 `plus` / `team`。
- `accessToken` 支持直接粘贴 `Bearer xxx`，服务端会自动去掉前缀。
- `options` 可选，用于覆盖默认 promo/referral/team 参数。
- 服务端会优先从 `checkout_session_id` 组装 `https://chatgpt.com/checkout/{processor}/{id}`，并兼容 `url / checkout_url / data.url` 等返回字段。

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
- 健康检查路径：`/healthz`（返回 `{ "status": "ok" }`）。
