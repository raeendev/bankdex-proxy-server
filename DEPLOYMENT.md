# 🚀 راهنمای کامل Deploy پروکسی روی app.bankdex.io

این راهنما شامل تمام روش‌های استقرار برای Linux و Windows Server است.

---

## 📑 فهرست مطالب

- [استقرار روی Linux](#-استقرار-روی-linux)
- [استقرار روی Windows Server](#-استقرار-روی-windows-server)
- [استقرار با Docker](#-استقرار-با-docker)
- [تنظیم SSL](#-تنظیم-ssl)
- [Troubleshooting](#-troubleshooting)

---

## 🐧 استقرار روی Linux

### پیش‌نیازها

- سرور Linux (Ubuntu 20.04+ یا Debian 11+)
- دسترسی root یا sudo
- Node.js 18+ نصب شده
- دامنه `app.bankdex.io` که به IP سرور شما اشاره می‌کند

> **💡 نکته:** این پروژه JavaScript خالص است و **نیازی به build ندارد**. مستقیماً با `node server.js` اجرا می‌شود.

### روش 1: با PM2 و Nginx (پیشنهادی)

#### مرحله 1: آماده‌سازی سرور

```bash
# به‌روزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# نصب PM2
sudo npm install -g pm2

# نصب Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### مرحله 2: آماده‌سازی پروژه

```bash
# انتقال فایل‌ها به سرور
cd /opt
git clone <your-repo-url> proxy-server
cd proxy-server

# نصب Dependencies
npm install --production

# ایجاد پوشه لاگ
mkdir -p logs
```

> **💡 نکته:** این پروژه JavaScript خالص است و **نیازی به build ندارد**. فقط `npm install` کافی است.

#### مرحله 3: تنظیم Environment Variables

```bash
# ایجاد فایل .env
cat > .env << EOF
PORT=3000
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
NODE_ENV=production
EOF
```

#### مرحله 4: تنظیم Nginx

```bash
# کپی تنظیمات
sudo cp nginx-app.bankdex.io.conf /etc/nginx/sites-available/app.bankdex.io
sudo ln -s /etc/nginx/sites-available/app.bankdex.io /etc/nginx/sites-enabled/

# بررسی و reload
sudo nginx -t
sudo systemctl reload nginx
```

#### مرحله 5: تنظیم SSL با Let's Encrypt

```bash
# نصب Certbot
sudo apt install -y certbot python3-certbot-nginx

# دریافت گواهینامه
sudo certbot --nginx -d app.bankdex.io
```

#### مرحله 6: راه‌اندازی با PM2

```bash
cd /opt/proxy-server
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # اجرای دستور نمایش داده شده
```

#### مرحله 7: باز کردن Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

#### مرحله 8: تست

```bash
# Health Check
curl https://app.bankdex.io/health

# Info
curl https://app.bankdex.io/info

# Proxy Test
curl -X GET "https://app.bankdex.io/api/proxy" \
  -H "X-Target-URL: https://api.orderly.org/v1/ip_info"
```

### روش 2: با systemd (بدون PM2)

#### ایجاد فایل service

```bash
sudo nano /etc/systemd/system/orderly-proxy.service
```

محتوای فایل:

```ini
[Unit]
Description=Orderly API Proxy Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/proxy-server
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### فعال‌سازی و اجرا

```bash
sudo systemctl daemon-reload
sudo systemctl enable orderly-proxy
sudo systemctl start orderly-proxy
sudo systemctl status orderly-proxy
```

---

## 🪟 استقرار روی Windows Server

### پیش‌نیازها

- Windows Server 2016+ یا Windows 10/11
- دسترسی Administrator
- Node.js 18+ نصب شده
- دامنه `app.bankdex.io` که به IP سرور شما اشاره می‌کند

> **💡 نکته:** این پروژه JavaScript خالص است و **نیازی به build ندارد**. مستقیماً با `node server.js` اجرا می‌شود.

### روش 1: با PM2 (ساده - پیشنهادی)

#### مرحله 1: نصب Node.js و PM2

```powershell
# نصب Node.js از nodejs.org (LTS version)

# نصب PM2
npm install -g pm2
npm install -g pm2-windows-startup
```

#### مرحله 2: آماده‌سازی پروژه

```powershell
# در مسیر پروژه (مثلاً C:\project\proxy-server)
cd C:\project\proxy-server

# نصب Dependencies
npm install --production

# ایجاد پوشه لاگ
New-Item -ItemType Directory -Path "logs" -Force
```

> **💡 نکته:** این پروژه JavaScript خالص است و **نیازی به build ندارد**. فقط `npm install` کافی است.

#### مرحله 3: تنظیم Environment Variables

```powershell
# ایجاد فایل .env
@"
PORT=80
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
NODE_ENV=production
"@ | Out-File -FilePath .env -Encoding utf8
```

**نکته:** برای HTTPS از `PORT=443` استفاده کنید (نیاز به SSL دارد).

#### مرحله 4: راه‌اندازی با PM2

```powershell
cd C:\project\proxy-server

# شروع سرور
pm2 start ecosystem.config.js --env production

# ذخیره تنظیمات
pm2 save

# تنظیم auto-start بعد از reboot
pm2-startup install
# دستور نمایش داده شده را اجرا کنید
```

#### مرحله 5: باز کردن Firewall

```powershell
# برای HTTP (پورت 80)
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# برای HTTPS (پورت 443)
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

#### مرحله 6: تنظیم SSL

**گزینه 1: استفاده از Cloudflare (پیشنهادی - ساده‌ترین روش)**

1. دامنه `app.bankdex.io` را در Cloudflare اضافه کنید
2. DNS را به IP سرور خود تنظیم کنید
3. SSL/TLS را روی "Full" یا "Full (strict)" تنظیم کنید
4. سرور را روی پورت 80 اجرا کنید (Cloudflare SSL را مدیریت می‌کند)

**گزینه 2: استفاده از win-acme (Let's Encrypt)**

```powershell
# دانلود win-acme از win-acme.com
# اجرا:
.\wacs.exe --target manual --validation filesystem --email your-email@example.com
```

#### مرحله 7: تست

```powershell
# Health Check
Invoke-WebRequest -Uri "http://app.bankdex.io/health" -UseBasicParsing

# یا در مرورگر
# http://app.bankdex.io/health
```

### روش 2: با Windows Service (بدون PM2)

#### نصب node-windows

```powershell
npm install -g node-windows
```

#### ایجاد Service

```powershell
# اجرای install-service.js
node install-service.js
```

#### مدیریت Service

```powershell
# Start
net start "Orderly Proxy Server"

# Stop
net stop "Orderly Proxy Server"

# یا از Services Manager استفاده کنید
services.msc
```

---

## 🐳 استقرار با Docker

### ساخت Docker Image

```bash
docker build -t orderly-proxy .
```

### اجرای Container

```bash
docker run -d \
  --name orderly-proxy \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io \
  --restart unless-stopped \
  orderly-proxy
```

### با Docker Compose

```bash
# ویرایش docker-compose.yml و تنظیم environment variables
docker-compose up -d
```

---

## 🔒 تنظیم SSL

### Linux: با Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx

# برای Nginx
sudo certbot --nginx -d app.bankdex.io

# برای standalone
sudo certbot certonly --standalone -d app.bankdex.io
```

### Windows: با win-acme

```powershell
# دانلود از win-acme.com
.\wacs.exe --target manual --validation filesystem --email your-email@example.com
```

### استفاده از Cloudflare (پیشنهادی)

1. دامنه را در Cloudflare اضافه کنید
2. DNS را تنظیم کنید
3. SSL/TLS را روی "Full" تنظیم کنید
4. سرور را روی پورت 80 اجرا کنید
5. تمام! Cloudflare SSL را مدیریت می‌کند

---

## 🔧 مدیریت سرور

### PM2 (Linux و Windows)

```bash
# مشاهده وضعیت
pm2 status

# مشاهده لاگ‌ها
pm2 logs orderly-proxy

# Restart
pm2 restart orderly-proxy

# Stop
pm2 stop orderly-proxy

# Monitoring
pm2 monit
```

### systemd (Linux)

```bash
# وضعیت
sudo systemctl status orderly-proxy

# Restart
sudo systemctl restart orderly-proxy

# Stop
sudo systemctl stop orderly-proxy

# لاگ‌ها
sudo journalctl -u orderly-proxy -f
```

### Windows Service

```powershell
# وضعیت
Get-Service "Orderly Proxy Server"

# Start
Start-Service "Orderly Proxy Server"

# Stop
Stop-Service "Orderly Proxy Server"
```

---

## 🔍 Troubleshooting

### بررسی لاگ‌ها

**PM2:**
```bash
pm2 logs orderly-proxy
```

**systemd:**
```bash
sudo journalctl -u orderly-proxy -f
```

**Windows Service:**
```powershell
Get-Content "C:\project\proxy-server\logs\*.log" -Tail 50
```

### بررسی Port

**Linux:**
```bash
sudo netstat -tulpn | grep 3000
# یا
sudo lsof -i :3000
```

**Windows:**
```powershell
netstat -ano | findstr :3000
```

### تست Health Check

```bash
# Linux
curl http://localhost:3000/health

# Windows
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
```

### مشکلات رایج

#### مشکل: Port در حال استفاده است

**Linux:**
```bash
# پیدا کردن process
sudo lsof -i :3000
# متوقف کردن
sudo kill -9 <PID>
```

**Windows:**
```powershell
# پیدا کردن process
netstat -ano | findstr :3000
# متوقف کردن (اگر IIS است)
Stop-Service W3SVC
```

#### مشکل: CORS Error

بررسی کنید که `ALLOWED_ORIGINS` در فایل `.env` شامل دامنه شما باشد:

```env
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
```

#### مشکل: SSL کار نمی‌کند

**Linux:**
```bash
# بررسی گواهینامه
sudo certbot certificates

# تمدید دستی
sudo certbot renew
```

**Windows:**
```powershell
# بررسی گواهینامه‌ها
Get-ChildItem Cert:\LocalMachine\My

# تمدید با win-acme
.\wacs.exe --renew
```

---

## 📝 Checklist قبل از Deploy

- [ ] Node.js نصب شده
- [ ] Dependencies نصب شده (`npm install --production`)
- [ ] فایل `.env` ایجاد و تنظیم شده
- [ ] `ALLOWED_ORIGINS` برای production تنظیم شده
- [ ] DNS تنظیم شده (`app.bankdex.io` → IP سرور)
- [ ] Firewall باز شده (پورت 80 و 443)
- [ ] SSL certificate نصب شده (یا Cloudflare تنظیم شده)
- [ ] سرور با PM2/systemd/Service در حال اجرا است
- [ ] Health check کار می‌کند
- [ ] Monitoring setup شده است

---

## 🌐 تنظیم در Frontend

بعد از deploy، در فایل `public/config.js` پروژه frontend:

```javascript
window.__RUNTIME_CONFIG__ = {
  // ... سایر تنظیمات
  "VITE_API_PROXY_URL": "https://app.bankdex.io/api/proxy"
};
```

---

## 📊 Monitoring

### با PM2

```bash
# مشاهده metrics
pm2 monit

# مشاهده اطلاعات
pm2 show orderly-proxy
```

### با Docker

```bash
# مشاهده stats
docker stats orderly-proxy

# مشاهده لاگ‌ها
docker logs orderly-proxy -f
```

---

## 🎉 تمام!

پس از انجام این مراحل، پروکسی شما باید روی `https://app.bankdex.io` در دسترس باشد.

**Endpoint اصلی:** `https://app.bankdex.io/api/proxy`
**Health Check:** `https://app.bankdex.io/health`
**Info:** `https://app.bankdex.io/info`

---

## 📚 منابع بیشتر

- [README.md](./README.md) - راهنمای اصلی پروژه
- [QUICKSTART.md](./QUICKSTART.md) - راهنمای شروع سریع
- [ecosystem.config.js](./ecosystem.config.js) - تنظیمات PM2
- [nginx-app.bankdex.io.conf](./nginx-app.bankdex.io.conf) - تنظیمات Nginx

