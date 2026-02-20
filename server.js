const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 8080);
const root = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const TEAM_DEFAULTS = {
  price_interval: 'month',
  seat_quantity: 5,
  country: 'US',
  currency: 'USD',
  promo_campaign_id: 'team-1-month-free'
};

const PLUS_DEFAULTS = {
  promo_campaign_id: 'plus-1-month-free'
};

function safeResolve(requestPath) {
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  return path.join(root, normalized);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function getWorkspaceNameFromToken(token) {
  const payload = decodeJwtPayload(token);
  const email = payload?.email || payload?.['https://api.openai.com/profile']?.email || payload?.['https://api.openai.com/auth']?.email;
  if (!email || !email.includes('@')) return 'MyTeam';
  return email.split('@')[0].slice(0, 32) || 'MyTeam';
}

async function createCheckoutSession({ token, planType }) {
  const cleanToken = normalizeAccessToken(token);
  if (!cleanToken) throw new Error('access token 不能为空');

  let payload;
  if (planType === 'team') {
    payload = {
      plan_name: 'chatgptteamplan',
      team_plan_data: {
        workspace_name: getWorkspaceNameFromToken(cleanToken),
        price_interval: TEAM_DEFAULTS.price_interval,
        seat_quantity: TEAM_DEFAULTS.seat_quantity
      },
      billing_details: {
        country: TEAM_DEFAULTS.country,
        currency: TEAM_DEFAULTS.currency
      },
      cancel_url: 'https://chatgpt.com/#pricing',
      promo_campaign: {
        promo_campaign_id: TEAM_DEFAULTS.promo_campaign_id,
        is_coupon_from_query_param: false
      },
      checkout_ui_mode: 'custom'
    };
  } else {
    payload = {
      plan_type: 'plus',
      checkout_ui_mode: 'custom',
      cancel_url: 'https://chatgpt.com/',
      success_url: 'https://chatgpt.com/',
      promo_campaign: {
        promo_campaign_id: PLUS_DEFAULTS.promo_campaign_id,
        is_coupon_from_query_param: false
      }
    };
  }

  const response = await fetch('https://chatgpt.com/backend-api/payments/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('403 Forbidden：token 可能过期/无效，或 token 前缀格式错误（请仅粘贴 token 本体，支持自动去除 Bearer 前缀）');
    }
    const message = data?.detail || data?.message || `请求失败 (${response.status})`;
    throw new Error(message);
  }

  if (data.checkout_session_id) {
    const processor = data.processor_entity || 'openai_llc';
    return `https://chatgpt.com/checkout/${processor}/${data.checkout_session_id}`;
  }
  if (data.url) return data.url;
  throw new Error('未能从响应中提取短链接');
}

function normalizeAccessToken(token) {
  if (typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (!trimmed) return '';
  const withoutQuotes = trimmed.replace(/^['\"]|['\"]$/g, '');
  return withoutQuotes.replace(/^Bearer\s+/i, '').trim();
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (req.method === 'POST' && urlPath === '/api/checkout-link') {
    readBody(req)
      .then(async raw => {
        let body;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          sendJson(res, 400, { error: '请求体不是合法 JSON' });
          return;
        }

        const planType = body.planType === 'team' ? 'team' : 'plus';
        if (!body.accessToken || typeof body.accessToken !== 'string') {
          sendJson(res, 400, { error: '缺少 accessToken' });
          return;
        }

        try {
          const checkoutUrl = await createCheckoutSession({ token: body.accessToken, planType });
          sendJson(res, 200, { checkoutUrl, planType });
        } catch (error) {
          sendJson(res, 400, { error: error.message || '生成短链接失败' });
        }
      })
      .catch(error => {
        sendJson(res, 500, { error: error.message || '服务器异常' });
      });
    return;
  }

  if (urlPath === '/healthz') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  const filePath = urlPath === '/' ? safeResolve('index.html') : safeResolve(urlPath.slice(1));

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
