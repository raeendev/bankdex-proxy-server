# راهنمای سریع شروع

## ⚡ شروع سریع (5 دقیقه)

### 1. نصب Dependencies

```bash
npm install
```

### 2. تنظیم Environment

```bash
# کپی فایل example
cp .env.example .env

# ویرایش .env (اختیاری - می‌توانید با مقادیر پیش‌فرض هم کار کند)
nano .env
```

### 3. اجرای سرور

```bash
# Development mode
npm run dev

# یا Production mode
npm start
```

### 4. تست

در terminal دیگر:

```bash
# Health check
curl http://localhost:3000/health

# تست proxy
curl -X GET "http://localhost:3000/api/proxy" \
  -H "X-Target-URL: https://api.orderly.org/v1/ip_info"
```

### 5. تنظیم در Frontend

در فایل `public/config.js` پروژه `Bankdex_Future`:

```javascript
window.__RUNTIME_CONFIG__ = {
  // ...
  "VITE_API_PROXY_URL": "http://localhost:3000/api/proxy"  // برای local
  // یا
  "VITE_API_PROXY_URL": "https://your-domain.com/api/proxy"  // برای production
};
```

## 🐳 با Docker

```bash
# Build
docker build -t orderly-proxy .

# Run
docker run -d -p 3000:3000 --name orderly-proxy orderly-proxy

# یا با docker-compose
docker-compose up -d
```

## ✅ آماده است!

سرور proxy شما آماده استفاده است. تمام درخواست‌های Orderly API از طریق این proxy هدایت می‌شوند.

برای اطلاعات بیشتر، `README.md` و `DEPLOYMENT.md` را مطالعه کنید.

