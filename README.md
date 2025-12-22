# Orderly Network API Proxy Server

این سرور proxy تمام درخواست‌های API از برنامه frontend را دریافت کرده و به Orderly Network API ارسال می‌کند.

## 📋 ویژگی‌ها

- ✅ هدایت تمام درخواست‌های Orderly API
- ✅ پشتیبانی از تمام HTTP methods (GET, POST, PUT, DELETE, PATCH)
- ✅ CORS configuration برای امنیت
- ✅ Validation دامنه‌های مجاز
- ✅ Error handling و logging
- ✅ Health check endpoint

## 🚀 راه‌اندازی سریع

### 1. نصب Dependencies

```bash
npm install
```

یا

```bash
yarn install
```

### 2. تنظیم Environment Variables

فایل `.env.example` را کپی کرده و به `.env` تغییر نام دهید:

```bash
cp .env.example .env
```

سپس فایل `.env` را ویرایش کنید:

```env
PORT=3000
ALLOWED_ORIGINS=https://bankdex.io,https://www.bankdex.io
NODE_ENV=production
```

### 3. اجرای سرور

#### Development Mode:

```bash
npm run dev
```

#### Production Mode:

```bash
npm start
```

## 📡 Endpoints

### `/api/proxy` (ALL methods)

Endpoint اصلی proxy که تمام درخواست‌ها را دریافت می‌کند.

**Headers مورد نیاز:**
- `X-Target-URL`: URL اصلی Orderly API که باید به آن درخواست ارسال شود

**یا Query Parameter:**
- `target_url`: URL اصلی Orderly API

**مثال درخواست:**

```bash
curl -X GET "http://localhost:3000/api/proxy" \
  -H "X-Target-URL: https://api.orderly.org/v1/ip_info"
```

یا:

```bash
curl -X GET "http://localhost:3000/api/proxy?target_url=https://api.orderly.org/v1/ip_info"
```

### `/health` (GET)

بررسی وضعیت سرور

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Orderly API Proxy"
}
```

### `/info` (GET)

اطلاعات سرور proxy

```bash
curl http://localhost:3000/info
```

**Response:**
```json
{
  "service": "Orderly API Proxy",
  "version": "1.0.0",
  "allowedDomains": [
    "api.orderly.org",
    "testnet-api.orderly.org",
    "orderly-dashboard-query-service.orderly.network",
    "api-woo.orderly.org"
  ],
  "endpoints": {
    "proxy": "/api/proxy",
    "health": "/health",
    "info": "/info"
  }
}
```

## 🔒 امنیت

### دامنه‌های مجاز

سرور فقط درخواست‌ها به دامنه‌های زیر را قبول می‌کند:

- `api.orderly.org`
- `testnet-api.orderly.org`
- `orderly-dashboard-query-service.orderly.network`
- `api-woo.orderly.org`

### CORS Configuration

برای تنظیم دامنه‌های مجاز برای CORS، متغیر `ALLOWED_ORIGINS` را در `.env` تنظیم کنید:

```env
ALLOWED_ORIGINS=https://bankdex.io,https://www.bankdex.io,https://app.bankdex.io
```

**نکته:** اگر `ALLOWED_ORIGINS` خالی باشد، همه دامنه‌ها مجاز هستند (فقط برای development).

## 🐳 Docker Deployment

### ساخت Docker Image:

```bash
docker build -t orderly-proxy .
```

### اجرای Container:

```bash
docker run -d \
  -p 3000:3000 \
  -e PORT=3000 \
  -e ALLOWED_ORIGINS=https://bankdex.io \
  -e NODE_ENV=production \
  --name orderly-proxy \
  orderly-proxy
```

### Docker Compose:

فایل `docker-compose.yml` را ایجاد کنید:

```yaml
version: '3.8'

services:
  proxy:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - ALLOWED_ORIGINS=https://bankdex.io
      - NODE_ENV=production
    restart: unless-stopped
```

سپس اجرا کنید:

```bash
docker-compose up -d
```

## 📝 تنظیم در Frontend

در فایل `public/config.js` پروژه frontend، proxy URL را تنظیم کنید:

```javascript
window.__RUNTIME_CONFIG__ = {
  // ... سایر تنظیمات
  "VITE_API_PROXY_URL": "https://your-proxy-server.com/api/proxy"
};
```

## 🔍 Logging

سرور تمام درخواست‌ها و خطاها را در console لاگ می‌کند. برای production، می‌توانید از یک logging library مثل `winston` استفاده کنید.

## ⚠️ نکات مهم

1. **HTTPS**: در production حتماً از HTTPS استفاده کنید
2. **Rate Limiting**: برای جلوگیری از abuse، rate limiting اضافه کنید
3. **Authentication**: اگر proxy شما public نیست، authentication اضافه کنید
4. **Monitoring**: از یک monitoring service استفاده کنید

## 🛠️ Development

برای development با auto-reload:

```bash
npm run dev
```

## 📦 Dependencies

- `express`: Web framework
- `cors`: CORS middleware
- `dotenv`: Environment variables management

## 📄 License

MIT

