/**
 * Orderly Network API Proxy Server
 * این سرور proxy تمام درخواست‌های API را از client دریافت کرده و به Orderly API ارسال می‌کند
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// بارگذاری متغیرهای محیطی
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Target-URL', 'X-Original-Method']
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
];

/**
 * بررسی اینکه آیا URL به دامنه‌های مجاز تعلق دارد
 */
function isAllowedDomain(url) {
  try {
    const urlObj = new URL(url);
    return ALLOWED_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch (error) {
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
    
    if (!targetUrl) {
      return res.status(400).json({ 
        error: 'Target URL is required',
        message: 'Please provide X-Target-URL header or target_url query parameter'
      });
    }

    // بررسی اینکه URL به دامنه‌های مجاز تعلق دارد
    if (!isAllowedDomain(targetUrl)) {
      return res.status(403).json({ 
        error: 'Forbidden domain',
        message: 'The target URL is not in the allowed domains list'
      });
    }

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

    // ارسال درخواست به Orderly API
    const response = await fetch(targetUrl, {
      method: method,
      headers: targetHeaders,
      body: requestBody,
    });

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
    // کپی کردن headers مهم
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      // فقط headers مهم را forward کن
      if (['content-type', 'content-length', 'cache-control', 'etag'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

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

// شروع سرور
app.listen(PORT, () => {
  console.log(`🚀 Proxy server is running on port ${PORT}`);
  console.log(`📍 Proxy endpoint: http://localhost:${PORT}/api/proxy`);
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

