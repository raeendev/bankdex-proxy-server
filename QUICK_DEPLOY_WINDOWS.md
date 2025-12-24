# ⚡ راهنمای سریع Deploy روی Windows Server (بدون IIS)

## 🎯 خلاصه مراحل (ساده و سریع)

### 1. نصب پیش‌نیازها

```powershell
# نصب Node.js از nodejs.org (LTS version)

# نصب PM2
npm install -g pm2
npm install -g pm2-windows-startup
```

### 2. آماده‌سازی پروژه

```powershell
# در مسیر پروژه (مثلاً C:\project\proxy-server)
cd C:\project\proxy-server

# نصب Dependencies
npm install --production

# ایجاد پوشه لاگ
New-Item -ItemType Directory -Path "logs" -Force
```

> **💡 نکته:** این پروژه JavaScript خالص است و **نیازی به build ندارد**. فقط `npm install` کافی است.

### 3. تنظیم Environment Variables

```powershell
# ایجاد فایل .env
@"
PORT=80
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
NODE_ENV=production
"@ | Out-File -FilePath .env -Encoding utf8
```

**نکته:** برای HTTPS از `PORT=443` استفاده کنید (نیاز به SSL دارد).

### 4. راه‌اندازی با PM2

```powershell
cd C:\project\proxy-server
pm2 start ecosystem.config.js --env production
pm2 save
pm2-startup install
```

### 5. باز کردن Firewall

```powershell
# برای HTTP (پورت 80)
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# برای HTTPS (پورت 443)
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 6. تنظیم SSL (اختیاری)

**پیشنهاد: استفاده از Cloudflare (ساده‌ترین روش)**
1. دامنه را در Cloudflare اضافه کنید
2. DNS را تنظیم کنید
3. SSL/TLS را روی "Full" تنظیم کنید
4. تمام! Cloudflare SSL را مدیریت می‌کند

### 7. تست

```powershell
# Health Check
Invoke-WebRequest -Uri "http://app.bankdex.io/health" -UseBasicParsing

# یا در مرورگر
# http://app.bankdex.io/health
```

---

## 🔧 دستورات مفید

### مدیریت PM2
```powershell
pm2 status              # وضعیت
pm2 logs orderly-proxy  # لاگ‌ها
pm2 restart orderly-proxy  # Restart
pm2 stop orderly-proxy     # Stop
pm2 monit               # Monitoring
```

### بررسی Port
```powershell
netstat -ano | findstr :3000
```

### بررسی IIS
```powershell
Get-Website
Get-WebBinding -Name "app.bankdex.io"
```

### Windows Firewall
```powershell
# باز کردن پورت 80 و 443
New-NetFirewallRule -DisplayName "HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## ⚠️ نکات مهم

1. **DNS**: مطمئن شوید که `app.bankdex.io` به IP سرور شما اشاره می‌کند
2. **Firewall**: پورت‌های 80 و 443 را باز کنید
3. **SSL**: پیشنهاد می‌شود از Cloudflare استفاده کنید (ساده‌ترین روش)
4. **Administrator**: برای اجرا روی پورت 80/443، PowerShell را به عنوان Administrator اجرا کنید
5. **IIS**: اگر IIS نصب است و می‌خواهید از Node.js مستقیماً استفاده کنید، آن را متوقف کنید: `Stop-Service W3SVC`

---

## 🚨 Troubleshooting

### سرور شروع نمی‌شود
```powershell
pm2 logs orderly-proxy --lines 50
netstat -ano | findstr :3000
```

### IIS خطا می‌دهد
- Event Viewer را بررسی کنید: `eventvwr.msc`
- لاگ‌های IIS: `C:\inetpub\logs\LogFiles`

### SSL کار نمی‌کند
```powershell
# بررسی گواهینامه‌ها
Get-ChildItem Cert:\LocalMachine\My

# تمدید با win-acme
.\wacs.exe --renew
```

---

## 🚀 استفاده از اسکریپت خودکار

```powershell
# PowerShell را به عنوان Administrator باز کنید
cd C:\project\proxy-server
.\deploy-windows.ps1
```

---

---

## 📚 راهنمای کامل

برای راهنمای کامل استقرار (شامل Linux، Windows، Docker و ...)، فایل **[DEPLOYMENT.md](./DEPLOYMENT.md)** را مطالعه کنید.

