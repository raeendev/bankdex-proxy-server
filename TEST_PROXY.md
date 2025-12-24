# راهنمای تست Proxy Server

## 🧪 تست‌های ضروری قبل از Deployment

### 1. تست مستقیم Proxy Server (بدون IIS)

```powershell
# Health check
curl http://localhost:3000/health

# تست API proxy
curl "http://localhost:3000/api/proxy?target_url=https://api.orderly.org/v1/public/futures"

# تست WebSocket (نیاز به ابزار خاص دارد)
# می‌توانید از browser console استفاده کنید:
# new WebSocket('ws://localhost:3000/api/ws-proxy?target_url=wss://ws-evm.orderly.org/ws/stream/test')
```

### 2. تست از طریق IIS (بعد از Deployment)

```powershell
# Health check از طریق IIS
curl https://app.bankdex.io/health

# تست API proxy از طریق IIS
curl "https://app.bankdex.io/api/proxy?target_url=https://api.orderly.org/v1/public/futures"
```

### 3. بررسی لاگ‌ها

```powershell
# لاگ‌های PM2
pm2 logs orderly-proxy --lines 50

# بررسی اینکه درخواست‌ها می‌رسند
# باید لاگ‌هایی مثل این ببینید:
# [Proxy] Incoming Request
# [Proxy] Target URL: ...
```

### 4. تست از Browser Console

```javascript
// در browser console
fetch('https://app.bankdex.io/api/proxy?target_url=https://api.orderly.org/v1/public/futures')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

## 🔍 تشخیص مشکل

### اگر تست مستقیم کار کرد اما از طریق IIS کار نکرد:

**مشکل:** IIS درخواست‌ها را forward نمی‌کند

**راه حل:**
1. بررسی کنید که `web.config` در root directory سایت IIS است
2. بررسی کنید که URL Rewrite Module نصب است
3. بررسی IIS Logs برای خطاها

### اگر هیچ لاگی نیست:

**مشکل:** درخواست‌ها به proxy server نمی‌رسند

**راه حل:**
1. بررسی کنید که PM2 در حال اجرا است: `pm2 list`
2. بررسی کنید که پورت 3000 باز است: `netstat -ano | findstr :3000`
3. بررسی IIS Logs برای ببینید که درخواست‌ها به IIS می‌رسند یا نه

### اگر 403 Forbidden می‌گیرید:

**مشکل:** Domain در لیست مجاز نیست

**راه حل:**
1. بررسی لاگ‌های proxy server
2. اضافه کردن domain به `ALLOWED_DOMAINS`
3. راه‌اندازی مجدد PM2

