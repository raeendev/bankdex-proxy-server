/**
 * Orderly Network API Proxy Server
 * این سرور proxy تمام درخواست‌های API را از client دریافت کرده و به Orderly API ارسال می‌کند
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

// بارگذاری متغیرهای محیطی
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

// Middleware برای لاگ کردن تمام درخواست‌ها (قبل از سایر middleware ها)
// این middleware باید قبل از CORS باشد تا همه درخواست‌ها لاگ شوند
app.use((req, res, next) => {
  // فقط لاگ می‌کنیم، بدون تغییر response
  const timestamp = new Date().toISOString();
  const targetUrl = req.headers['x-target-url'] || req.query.target_url || 'none';
  console.log(`[${timestamp}] [${req.method}] ${req.path} | Origin: ${req.headers.origin || 'none'} | Target: ${targetUrl}`);
  next();
});

// Middleware
// برای CORS، باید origin را به صورت dynamic تنظیم کنیم تا با credentials کار کند
app.use(cors({
  origin: function (origin, callback) {
    // در development، همه origins را قبول می‌کنیم
    if (process.env.NODE_ENV === 'development' || !origin) {
      return callback(null, true);
    }
    
    // در production، فقط origins مجاز را قبول می‌کنیم
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Target-URL', 
    'X-Original-Method', 
    'Accept', 
    'Accept-Language', 
    'Content-Language',
    'privy-client', // Privy authentication header
    'privy-app-id', // Privy app ID header
    'X-Requested-With',
    'Origin',
    'Referer',
    'User-Agent'
  ]
}));

app.use(express.json());
app.use(express.text());
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// لیست دامنه‌های مجاز Orderly API
const ALLOWED_DOMAINS = [
  'api.orderly.org',
  'testnet-api.orderly.org',
  'orderly-dashboard-query-service.orderly.network',
  'api-woo.orderly.org',
  'ws-evm.orderly.org', // WebSocket domain
  'oss.orderly.network', // برای تصاویر و assets
  'api.eu.amplitude.com', // Amplitude analytics
  'auth.privy.io', // Privy authentication
  'explorer-api.walletconnect.com', // WalletConnect explorer
  'pulse.walletconnect.org', // WalletConnect pulse
  'api.web3modal.org', // Web3Modal API
];

/**
 * بررسی اینکه آیا URL به دامنه‌های مجاز تعلق دارد
 */
function isAllowedDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // بررسی دقیق‌تر: hostname باید دقیقاً برابر domain باشد یا به آن ختم شود
    const isAllowed = ALLOWED_DOMAINS.some(domain => {
      const domainLower = domain.toLowerCase();
      // بررسی دقیق: hostname باید دقیقاً برابر domain باشد یا به .domain ختم شود
      return hostname === domainLower || hostname.endsWith('.' + domainLower);
    });
    
    if (!isAllowed) {
      console.warn(`[Domain Check] Forbidden domain: ${hostname} (from URL: ${url})`);
      console.log(`[Domain Check] Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
    } else {
      console.log(`[Domain Check] Allowed domain: ${hostname}`);
    }
    
    return isAllowed;
  } catch (error) {
    console.error(`[Domain Check] Error parsing URL: ${url}`, error);
    return false;
  }
}

/**
 * حذف headers غیرضروری که نباید به target ارسال شوند
 */
function cleanHeaders(headers) {
  const cleaned = { ...headers };
  
  // حذف headers که نباید forward شوند
  delete cleaned['host'];
  delete cleaned['connection'];
  delete cleaned['content-length'];
  delete cleaned['x-target-url'];
  delete cleaned['x-original-method'];
  delete cleaned['origin'];
  delete cleaned['referer'];
  
  return cleaned;
}

/**
 * Endpoint اصلی proxy
 */
app.all('/api/proxy', async (req, res) => {
  try {
    // دریافت URL اصلی از header یا query parameter
    const targetUrl = req.headers['x-target-url'] || req.query.target_url;
    
    // لاگ کردن تمام اطلاعات درخواست برای دیباگ
    console.log(`\n========== [Proxy] New Request ==========`);
    console.log(`[Proxy] Time: ${new Date().toISOString()}`);
    console.log(`[Proxy] Method: ${req.method}`);
    console.log(`[Proxy] Path: ${req.path}`);
    console.log(`[Proxy] Full URL: ${req.url}`);
    console.log(`[Proxy] Query params:`, JSON.stringify(req.query, null, 2));
    console.log(`[Proxy] Headers X-Target-URL:`, req.headers['x-target-url']);
    console.log(`[Proxy] All Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[Proxy] Target URL (raw): ${targetUrl}`);
    console.log(`==========================================\n`);
    
    if (!targetUrl) {
      console.error('[Proxy] Target URL is missing');
      console.error('[Proxy] Available headers:', Object.keys(req.headers));
      console.error('[Proxy] Available query params:', Object.keys(req.query));
      return res.status(400).json({ 
        error: 'Target URL is required',
        message: 'Please provide X-Target-URL header or target_url query parameter'
      });
    }

    // Decode URL اگر encoded است
    let decodedTargetUrl = targetUrl;
    try {
      decodedTargetUrl = decodeURIComponent(targetUrl);
      console.log(`[Proxy] Target URL (decoded): ${decodedTargetUrl}`);
    } catch (e) {
      console.warn(`[Proxy] Could not decode URL, using as-is: ${e.message}`);
    }

    // بررسی اینکه URL به دامنه‌های مجاز تعلق دارد
    const domainCheckResult = isAllowedDomain(decodedTargetUrl);
    console.log(`[Proxy] Domain check result: ${domainCheckResult} for ${decodedTargetUrl}`);
    
    if (!domainCheckResult) {
      console.error(`[Proxy] Forbidden domain: ${decodedTargetUrl}`);
      console.error(`[Proxy] Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
      return res.status(403).json({ 
        error: 'Forbidden domain',
        message: 'The target URL is not in the allowed domains list',
        targetUrl: decodedTargetUrl,
        allowedDomains: ALLOWED_DOMAINS
      });
    }
    
    // استفاده از decoded URL برای ادامه
    const finalTargetUrl = decodedTargetUrl;

    // دریافت method از header یا استفاده از method درخواست
    const method = req.headers['x-original-method'] || req.method;
    
    // آماده‌سازی headers
    const targetHeaders = cleanHeaders(req.headers);
    
    // آماده‌سازی body
    let requestBody = null;
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      // اگر body به صورت JSON است
      if (req.headers['content-type']?.includes('application/json')) {
        requestBody = JSON.stringify(req.body);
      } 
      // اگر body به صورت text است
      else if (req.headers['content-type']?.includes('text/')) {
        requestBody = req.body;
      }
      // اگر body به صورت raw است
      else {
        requestBody = req.body;
      }
    }

    // حذف cache headers از درخواست برای جلوگیری از 304 responses
    delete targetHeaders['if-none-match'];
    delete targetHeaders['if-modified-since'];
    delete targetHeaders['cache-control'];
    
    // ارسال درخواست به Orderly API با cache: no-store
    console.log(`[Proxy] Fetching: ${method} ${finalTargetUrl}`);
    const response = await fetch(finalTargetUrl, {
      method: method,
      headers: targetHeaders,
      body: requestBody,
      cache: 'no-store', // غیرفعال کردن cache
    });
    
    console.log(`[Proxy] Response status: ${response.status} ${response.statusText}`);

    // دریافت response body
    const contentType = response.headers.get('content-type') || '';
    let responseData;
    
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else if (contentType.includes('text/')) {
      responseData = await response.text();
    } else {
      responseData = await response.arrayBuffer();
    }

    // ارسال پاسخ به client
    // کپی کردن headers مهم (بدون cache headers برای جلوگیری از 304)
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // حذف cache headers برای جلوگیری از 304 responses
      if (['cache-control', 'etag', 'last-modified', 'expires'].includes(lowerKey)) {
        return; // این headers را forward نکن
      }
      // فقط headers مهم را forward کن
      if (['content-type', 'content-length'].includes(lowerKey)) {
        responseHeaders[key] = value;
      }
    });
    
    // اضافه کردن no-cache headers برای اطمینان
    responseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
    responseHeaders['Pragma'] = 'no-cache';
    responseHeaders['Expires'] = '0';

    res.status(response.status)
       .set(responseHeaders)
       .send(responseData);

  } catch (error) {
    console.error('Proxy error:', error);
    
    // ارسال خطای مناسب
    res.status(500).json({ 
      error: 'Proxy server error',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Orderly API Proxy'
  });
});

/**
 * اطلاعات proxy server
 */
app.get('/info', (req, res) => {
  res.json({
    service: 'Orderly API Proxy',
    version: '1.0.0',
    allowedDomains: ALLOWED_DOMAINS,
    endpoints: {
      proxy: '/api/proxy',
      health: '/health',
      info: '/info'
    }
  });
});

/**
 * WebSocket Proxy Server
 * این بخش WebSocket connections را proxy می‌کند
 * استفاده از upgrade handler برای WebSocket
 */
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  // فقط برای path /api/ws-proxy
  if (pathname === '/api/ws-proxy') {
    wss.handleUpgrade(request, socket, head, (clientWs, req) => {
      wss.emit('connection', clientWs, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (clientWs, req) => {
  let targetWs = null;
  let isClosing = false;
  
  try {
    console.log(`[WebSocket] New connection from: ${req.headers.origin || 'unknown'}`);
    console.log(`[WebSocket] Client readyState: ${clientWs.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
    
    // بررسی اینکه client connection برقرار است
    // در WebSocket، وقتی connection event fire می‌شود، connection معمولاً OPEN است
    if (clientWs.readyState !== WebSocket.OPEN) {
      console.warn(`[WebSocket] Client connection is not OPEN (state: ${clientWs.readyState}), waiting...`);
    }
    
    // دریافت target URL از query parameter
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = url.searchParams.get('target_url');
    
    console.log(`[WebSocket] Request URL: ${req.url}`);
    console.log(`[WebSocket] Target URL: ${targetUrl}`);
    
    if (!targetUrl) {
      console.error('[WebSocket] Target URL is missing');
      clientWs.close(1008, 'Target URL is required. Use ?target_url=wss://...');
      return;
    }

    // بررسی اینکه URL به دامنه‌های مجاز تعلق دارد
    if (!isAllowedDomain(targetUrl)) {
      console.error(`[WebSocket] Forbidden domain: ${targetUrl}`);
      clientWs.close(1008, 'Forbidden domain. The target URL is not in the allowed domains list');
      return;
    }

    // تبدیل http/https به ws/wss
    let wsTargetUrl = targetUrl;
    if (wsTargetUrl.startsWith('http://')) {
      wsTargetUrl = wsTargetUrl.replace('http://', 'ws://');
    } else if (wsTargetUrl.startsWith('https://')) {
      wsTargetUrl = wsTargetUrl.replace('https://', 'wss://');
    } else if (!wsTargetUrl.startsWith('ws://') && !wsTargetUrl.startsWith('wss://')) {
      // اگر protocol مشخص نشده، wss را اضافه کن
      wsTargetUrl = 'wss://' + wsTargetUrl;
    }

    console.log(`[WebSocket] Connecting to: ${wsTargetUrl}`);

    // ایجاد اتصال WebSocket به target
    targetWs = new WebSocket(wsTargetUrl);

    // وقتی target متصل شد
    targetWs.on('open', () => {
      console.log(`[WebSocket] Connected to target: ${wsTargetUrl}`);
      // اطمینان حاصل کنید که client هنوز باز است
      if (clientWs.readyState === WebSocket.OPEN) {
        console.log(`[WebSocket] Both connections are open, ready to forward messages`);
      } else {
        console.warn(`[WebSocket] Client connection is not open (state: ${clientWs.readyState}), closing target`);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.close();
        }
      }
    });

    // اگر target قبل از اتصال خطا داد
    targetWs.on('error', (error) => {
      console.error('[WebSocket] Target connection error (before open):', error);
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        clientWs.close(1011, 'Target connection failed');
      }
    });

    // Forward پیام‌ها از client به target
    clientWs.on('message', (data, isBinary) => {
      if (!isClosing && targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(data, { binary: isBinary });
      }
    });

    // Forward پیام‌ها از target به client
    targetWs.on('message', (data, isBinary) => {
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    // مدیریت خطاها
    targetWs.on('error', (error) => {
      console.error('[WebSocket] Target connection error:', error);
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        clientWs.close(1011, 'Target connection error');
      }
    });

    clientWs.on('error', (error) => {
      console.error('[WebSocket] Client connection error:', error);
      if (!isClosing && targetWs && targetWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        targetWs.close();
      }
    });

    // مدیریت بسته شدن اتصال
    targetWs.on('close', (code, reason) => {
      console.log(`[WebSocket] Target connection closed: ${code} ${reason.toString() || 'no reason'}`);
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        clientWs.close(code, reason.toString() || 'Target closed');
      }
    });

    clientWs.on('close', (code, reason) => {
      console.log(`[WebSocket] Client connection closed: ${code} ${reason.toString() || 'no reason'}`);
      if (!isClosing && targetWs && targetWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        targetWs.close();
      }
    });

  } catch (error) {
    console.error('[WebSocket] Proxy error:', error);
    if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
      isClosing = true;
      clientWs.close(1011, 'Proxy server error: ' + error.message);
    }
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.close();
    }
  }
});

// شروع سرور
server.listen(PORT, () => {
  console.log(`🚀 Proxy server is running on port ${PORT}`);
  console.log(`📍 HTTP Proxy endpoint: http://localhost:${PORT}/api/proxy`);
  console.log(`🔌 WebSocket Proxy endpoint: ws://localhost:${PORT}/api/ws-proxy`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`ℹ️  Info: http://localhost:${PORT}/info`);
  console.log(`\n✅ Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  
  if (process.env.ALLOWED_ORIGINS) {
    console.log(`🌐 Allowed origins: ${process.env.ALLOWED_ORIGINS}`);
  } else {
    console.log(`⚠️  Warning: CORS is set to allow all origins (*)`);
  }
});

// مدیریت خطاهای unhandled
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

