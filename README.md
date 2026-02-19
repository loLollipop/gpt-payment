# gpt-payment

一个简单的网页工具：输入 ChatGPT 支付长链接，提取对应短链接。

## 使用方法

1. 打开 `index.html`。
2. 粘贴支付长链接（例如包含 `checkout_session_id` / `session_id` 参数）。
3. 点击 **提取短链接**。
4. 可点击 **复制结果**。

短链接格式：

```text
https://chatgpt.com/checkout/{processor}/{checkout_session_id}
```

默认 `processor` 为 `openai_llc`（当原始链接未提供时）。
