# چک‌لیست Deployment Proxy Server

## 🔍 بررسی مشکلات رایج

### 1. بررسی اینکه Proxy Server در حال اجرا است

```powershell
# بررسی PM2
pm2 list

# بررسی پورت 3000
netstat -ano | findstr :3000

# یا
Get-NetTCPConnection -LocalPort 3000
```

### 2. تست مستقیم Proxy Server (بدون IIS)

```powershell
# تست health check
curl http://localhost:3000/health

# تست proxy endpoint
curl "http://localhost:3000/api/proxy?target_url=https://api.orderly.org/v1/public/futures"
```

اگر این تست‌ها کار کردند، مشکل از IIS است.

### 3. بررسی IIS Rewrite Rules

```powershell
# بررسی اینکه URL Rewrite Module نصب است
Get-WebGlobalModule | Where-Object {$_.Name -like "*Rewrite*"}

# اگر نصب نیست، باید از Web Platform Installer نصب کنید
```

### 4. بررسی IIS Logs

مسیر لاگ‌های IIS:
```
C:\inetpub\logs\LogFiles\W3SVC<site-id>\
```

برای پیدا کردن Site ID:
1. باز کردن IIS Manager
2. انتخاب سایت proxy
3. دوبار کلیک روی **Logging**
4. مسیر لاگ در قسمت **Directory** نمایش داده می‌شود

### 5. بررسی WebSocket Support در IIS

برای WebSocket، باید:
1. **WebSocket Protocol** نصب باشد (در سرور production)
2. IIS باید WebSocket upgrade requests را forward کند

## 📋 مراحل Deployment

### مرحله 1: کپی کردن فایل‌ها به سرور

```powershell
# کپی کردن فایل‌های proxy server
# از لوکال به سرور
```

### مرحله 2: نصب Dependencies

```powershell
cd C:\project\proxy-server
npm install
```

### مرحله 3: راه‌اندازی با PM2

```powershell
# راه‌اندازی
pm2 start ecosystem.config.cjs --env production

# یا
pm2 start server.js --name orderly-proxy --env production

# ذخیره تنظیمات
pm2 save

# راه‌اندازی خودکار با سیستم
pm2 startup
```

### مرحله 4: کپی کردن web.config به IIS

```powershell
# کپی کردن web.config به مسیر IIS site
# معمولاً در: C:\inetpub\wwwroot\<site-name>\
```

### مرحله 5: راه‌اندازی مجدد IIS

```powershell
iisreset
```

### مرحله 6: بررسی لاگ‌ها

```powershell
# لاگ‌های PM2
pm2 logs orderly-proxy --lines 100

# لاگ‌های IIS
# در Event Viewer یا IIS Logs
```

## 🐛 Troubleshooting

### مشکل: هیچ لاگی در proxy server نیست

**علت احتمالی:**
- IIS درخواست‌ها را forward نمی‌کند
- URL Rewrite Module نصب نیست
- web.config در مسیر اشتباه است

**راه حل:**
1. بررسی کنید که `web.config` در root directory سایت IIS است
2. بررسی کنید که URL Rewrite Module نصب است
3. بررسی کنید که IIS site به درستی تنظیم شده است

### مشکل: 403 Forbidden

**علت احتمالی:**
- Domain در لیست مجاز نیست
- مشکل در domain validation

**راه حل:**
1. بررسی لاگ‌های proxy server برای دیدن domain rejected
2. اضافه کردن domain به `ALLOWED_DOMAINS` در `server.js`
3. راه‌اندازی مجدد PM2

### مشکل: CORS Error

**علت احتمالی:**
- CORS headers duplicate هستند
- CORS middleware درست تنظیم نشده

**راه حل:**
1. مطمئن شوید که CORS headers از `web.config` حذف شده‌اند
2. فقط Express CORS middleware باید CORS را مدیریت کند
3. راه‌اندازی مجدد IIS و PM2

### مشکل: WebSocket بسته می‌شود

**علت احتمالی:**
- WebSocket Protocol در IIS نصب نیست
- IIS WebSocket upgrade را forward نمی‌کند
- Race condition در proxy server

**راه حل:**
1. نصب WebSocket Protocol در سرور production
2. بررسی اینکه IIS WebSocket upgrade را forward می‌کند
3. بررسی لاگ‌های proxy server برای WebSocket connections

## 📝 دستورات مفید

```powershell
# بررسی وضعیت PM2
pm2 status

# مشاهده لاگ‌های real-time
pm2 logs orderly-proxy

# راه‌اندازی مجدد
pm2 restart orderly-proxy

# توقف
pm2 stop orderly-proxy

# حذف
pm2 delete orderly-proxy

# راه‌اندازی مجدد IIS
iisreset

# بررسی پورت
netstat -ano | findstr :3000

# تست health check
curl http://localhost:3000/health

# تست proxy
curl "http://localhost:3000/api/proxy?target_url=https://api.orderly.org/v1/public/futures"
```

## 🔧 تنظیمات Environment Variables

در سرور production، باید این متغیرها را تنظیم کنید:

```powershell
# در ecosystem.config.cjs یا .env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
```

یا در PM2:

```powershell
pm2 start server.js --name orderly-proxy --env production --update-env
```

## ⚠️ نکات مهم

1. **web.config باید در root directory سایت IIS باشد**
2. **URL Rewrite Module باید نصب باشد**
3. **WebSocket Protocol باید در سرور production نصب باشد**
4. **PM2 باید با environment production اجرا شود**
5. **CORS headers فقط باید از Express CORS middleware بیایند**

