/**
 * Orderly Network API Proxy Server (hardened)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { Readable } from 'stream';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = createServer(app);

// Pre-CORS request log (disabled to reduce console noise)
// app.use((req, res, next) => {
//   const ts = new Date().toISOString();
//   const targetUrl = req.headers['x-target-url'] || req.query.target_url || 'none';
//   if (process.env.NODE_ENV !== 'production') {
//     console.log(`[${ts}] [${req.method}] ${req.path} | Origin: ${req.headers.origin || 'none'} | Target: ${targetUrl}`);
//   }
//   next();
// });

// CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (process.env.NODE_ENV === 'development' || !origin) {
        return callback(null, true);
      }
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
      'X-Requested-With',
      'Origin',
      'Referer',
      'User-Agent',
      'privy-client',
      'privy-app-id',
      'privy-ca-id',
    ],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '10mb' }));

// Upstream allowlist (proxy-only egress)
const ALLOWED_DOMAINS = [
  'api.orderly.org',
  'testnet-api.orderly.org',
  'orderly-dashboard-query-service.orderly.network',
  'api-woo.orderly.org',
  'ws-evm.orderly.org',
  'oss.orderly.network',
  'api.eu.amplitude.com',
  'auth.privy.io',
  'explorer-api.walletconnect.com',
  'pulse.walletconnect.org',
  'relay.walletconnect.org',
  'relay.walletconnect.com',
  'api.web3modal.org',
];

function isAllowedDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some((domain) => {
      const d = domain.toLowerCase();
      return hostname === d || hostname.endsWith('.' + d);
    });
  } catch {
    return false;
  }
}

// Strict header forward allowlist (Authorization allowed per user choice)
function buildForwardHeaders(incoming) {
  const src = incoming || {};
  const allowed = new Map();
  function pick(name) {
    const key = name.toLowerCase();
    if (src[key] != null) allowed.set(name, src[key]);
  }
  pick('accept');
  pick('accept-language');
  pick('content-type');
  pick('content-language');
  pick('authorization'); // allowed
  pick('user-agent');
  pick('privy-client');
  pick('privy-app-id');
  pick('privy-ca-id');
  // Do NOT forward: cookie, origin, referer, sec-*, connection, host, x-*
  // Hop-by-hop headers are stripped implicitly by not including them
  const out = {};
  allowed.forEach((v, k) => (out[k] = v));
  return out;
}

// HTTP proxy endpoint (header-only for target URL)
app.all('/api/proxy', async (req, res) => {
  try {
    const targetUrlHeader = req.headers['x-target-url'];

    if (!targetUrlHeader) {
      return res.status(400).json({
        error: 'Target URL is required',
        message: 'Provide X-Target-URL header. Query parameter target_url is not accepted for HTTP.',
      });
    }

    let targetUrl = String(targetUrlHeader);
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch {}

    // Scheme checks: http/https only for HTTP path
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL', message: 'X-Target-URL must be a valid absolute URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).json({
        error: 'Invalid scheme',
        message: 'Only http and https are allowed for /api/proxy',
      });
    }

    if (!isAllowedDomain(targetUrl)) {
      return res.status(403).json({
        error: 'Forbidden domain',
        message: 'The target URL is not in the allowed domains list',
        targetUrl,
        allowedDomains: ALLOWED_DOMAINS,
      });
    }

    const method = (req.headers['x-original-method'] || req.method).toString().toUpperCase();
    const headers = buildForwardHeaders(req.headers);

    // Build body - handle various body types
    let body = null;
    if (!['GET', 'HEAD'].includes(method)) {
      // Check if body exists and is not empty
      // Express may parse empty body as {} (empty object), so we need to check for that
      const hasBody = req.body !== undefined && req.body !== null;
      const isEmptyObject = hasBody && typeof req.body === 'object' && Object.keys(req.body).length === 0;
      
      if (hasBody && !isEmptyObject) {
        const contentType = req.headers['content-type'] || '';
        
        // Handle JSON body
        if (contentType.includes('application/json')) {
          if (typeof req.body === 'string') {
            body = req.body;
          } else {
            body = JSON.stringify(req.body);
          }
        }
        // Handle text/plain body
        else if (contentType.includes('text/')) {
          body = typeof req.body === 'string' ? req.body : String(req.body);
        }
        // Handle form data (application/x-www-form-urlencoded)
        else if (contentType.includes('application/x-www-form-urlencoded')) {
          // Express.urlencoded() already parses this, but we need to send it as string
          if (typeof req.body === 'string') {
            body = req.body;
          } else if (typeof req.body === 'object') {
            // Convert object to URL-encoded string
            body = new URLSearchParams(req.body).toString();
          } else {
            body = String(req.body);
          }
        }
        // Handle other types (form data, etc.)
        else {
          body = req.body;
        }
      }
      // For POST/PUT/PATCH with no body or empty body, set body to undefined (not null)
      // This allows fetch to handle it correctly
      else {
        body = undefined;
      }
    }

    // Timeout and retry parameters
    const TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 120000);
    const RETRY_MAX = Number(process.env.PROXY_RETRY_MAX || 2);
    const RETRY_BASE_MS = Number(process.env.PROXY_RETRY_BASE_MS || 300);

    async function fetchWithTimeout(input, init, timeoutMs) {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(input, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(to);
      }
    }

    async function fetchWithRetry(input, init) {
      let attempt = 0;
      while (true) {
        attempt++;
        try {
          const resp = await fetchWithTimeout(input, init, TIMEOUT_MS);
          if (resp.status >= 500 || resp.status === 429) {
            if (attempt <= RETRY_MAX) {
              const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
          }
          return resp;
        } catch (err) {
          const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
          const isNetwork = err && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND');
          if ((isAbort || isNetwork) && attempt <= RETRY_MAX) {
            const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw err;
        }
      }
    }

    const init = {
      method,
      headers,
      cache: 'no-store',
    };
    
    // Only include body if it's not null/undefined
    // For GET/HEAD, body should be undefined
    // For POST/PUT/PATCH with no body, body should be undefined (not null)
    // Note: fetch() will automatically handle undefined body correctly
    if (body !== null && body !== undefined) {
      init.body = body;
    }
    // For POST/PUT/PATCH with no body, don't include body property at all
    // This allows fetch to handle it correctly (some servers accept empty POST, some don't)

    let response;
    try {
      response = await fetchWithRetry(targetUrl, init);
    } catch (err) {
      const isAbort = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
      if (isAbort) {
        return res.status(504).json({ error: 'Gateway Timeout', message: `Upstream timeout after ${TIMEOUT_MS}ms` });
      }
      return res.status(502).json({ error: 'Bad Gateway', message: err.message || 'Upstream fetch failed' });
    }

    // Build response headers (strip cache and compression headers)
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      // Strip cache, encoding, and hop-by-hop headers
      if (['cache-control', 'etag', 'last-modified', 'expires', 'content-encoding', 'content-length'].includes(lower)) return;
      if (!['connection', 'transfer-encoding', 'keep-alive', 'upgrade'].includes(lower)) {
        responseHeaders[key] = value;
      }
    });
    responseHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
    responseHeaders['Pragma'] = 'no-cache';
    responseHeaders['Expires'] = '0';

    const bodyStream = response.body;
    res.status(response.status);
    res.set(responseHeaders);

    if (bodyStream && typeof bodyStream.getReader === 'function') {
      try {
        const nodeStream = Readable.fromWeb(bodyStream);
        nodeStream.on('error', () => {
          if (!res.headersSent) res.status(502);
          res.end();
        });
        nodeStream.pipe(res);
      } catch (e) {
        const arrayBuf = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuf));
      }
    } else {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        res.send(data);
      } else if (contentType.includes('text/')) {
        const data = await response.text();
        res.send(data);
      } else {
        const arrayBuf = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuf));
      }
    }
  } catch (error) {
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
});

// Health & Info
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Orderly API Proxy' });
});
app.get('/info', (req, res) => {
  res.json({
    service: 'Orderly API Proxy',
    version: '1.0.0',
    allowedDomains: ALLOWED_DOMAINS,
    endpoints: { proxy: '/api/proxy', health: '/health', info: '/info' },
  });
});

// WebSocket proxy (strict ws/wss scheme, header-based policies)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    if (pathname === '/api/ws-proxy') {
      wss.handleUpgrade(request, socket, head, (clientWs, req) => {
        wss.emit('connection', clientWs, req);
      });
    } else {
      socket.destroy();
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[WebSocket Upgrade] Error:', error?.message, request.url);
    }
    socket.destroy();
  }
});

wss.on('connection', (clientWs, req) => {
  let targetWs = null;
  let isClosing = false;
  try {
    // Parse URL from request - handle both absolute and relative URLs
    let url;
    try {
      // Try to parse as absolute URL first
      url = new URL(req.url);
    } catch {
      // If that fails, try with host header
      const host = req.headers.host || 'localhost';
      const protocol = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
      url = new URL(req.url, `${protocol}://${host}`);
    }
    
    let targetUrl = url.searchParams.get('target_url');
    if (!targetUrl) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[WebSocket Proxy] Missing target_url in request:', req.url);
      }
      clientWs.close(1008, 'Target URL is required. Use ?target_url=wss://...');
      return;
    }
    
    // Decode URL if it's encoded
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch {
      // If decoding fails, use original
    }
    
    // Strict ws/wss only for WS path
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      clientWs.close(1008, 'Invalid target_url');
      return;
    }
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      clientWs.close(1008, 'Invalid scheme: only ws/wss allowed for /api/ws-proxy');
      return;
    }

    if (!isAllowedDomain(targetUrl)) {
      clientWs.close(1008, 'Forbidden domain. The target URL is not in the allowed domains list');
      return;
    }

    // Create WebSocket connection to target
    try {
      targetWs = new WebSocket(targetUrl);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[WebSocket Proxy] Failed to create target WebSocket:', error?.message, targetUrl);
      }
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        clientWs.close(1011, 'Failed to create target WebSocket: ' + (error?.message || 'Unknown error'));
      }
      return;
    }

    targetWs.on('open', () => {
      // Only close target if client is already closed
      if (clientWs.readyState === WebSocket.CLOSED || clientWs.readyState === WebSocket.CLOSING) {
        if (targetWs.readyState === WebSocket.OPEN) targetWs.close();
      }
    });

    targetWs.on('error', (error) => {
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        const errorMsg = error?.message || 'Target connection failed';
        if (process.env.NODE_ENV === 'development') {
          console.error('[WebSocket Proxy] Target connection error:', errorMsg, targetUrl);
        }
        clientWs.close(1011, errorMsg);
      }
    });

    clientWs.on('message', (data, isBinary) => {
      if (!isClosing && targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(data, { binary: isBinary });
      }
    });

    targetWs.on('message', (data, isBinary) => {
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    targetWs.on('close', (code, reason) => {
      if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        clientWs.close(code, reason.toString() || 'Target closed');
      }
    });

    clientWs.on('close', () => {
      if (!isClosing && targetWs && targetWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        targetWs.close();
      }
    });

    clientWs.on('error', (error) => {
      if (!isClosing && targetWs && targetWs.readyState === WebSocket.OPEN) {
        isClosing = true;
        const errorMsg = error?.message || 'Client connection error';
        if (process.env.NODE_ENV === 'development') {
          console.error('[WebSocket Proxy] Client connection error:', errorMsg);
        }
        targetWs.close();
      }
    });
  } catch (error) {
    if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
      isClosing = true;
      const errorMsg = 'Proxy server error: ' + (error?.message || 'Unknown error');
      if (process.env.NODE_ENV === 'development') {
        console.error('[WebSocket Proxy] Error:', errorMsg, error);
      }
      clientWs.close(1011, errorMsg);
    }
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.close();
    }
  }
});

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

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});
