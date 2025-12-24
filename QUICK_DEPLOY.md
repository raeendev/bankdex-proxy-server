# ⚡ راهنمای سریع Deploy روی app.bankdex.io

## 🎯 خلاصه مراحل

### 1. آماده‌سازی سرور
```bash
# به‌روزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# نصب PM2
sudo npm install -g pm2

# نصب Nginx
sudo apt install -y nginx
```

### 2. انتقال و نصب پروژه
```bash
# انتقال فایل‌ها به سرور (از کامپیوتر محلی)
scp -r proxy-server/ user@server-ip:/opt/

# در سرور
cd /opt/proxy-server
npm install --production
mkdir -p logs
```

> **💡 نکته:** این پروژه JavaScript خالص است و **نیازی به build ندارد**. فقط `npm install` کافی است.

### 3. تنظیم Environment Variables
```bash
# ایجاد فایل .env
cat > .env << EOF
PORT=3000
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
NODE_ENV=production
EOF
```

### 4. تنظیم Nginx
```bash
# کپی تنظیمات
sudo cp nginx-app.bankdex.io.conf /etc/nginx/sites-available/app.bankdex.io
sudo ln -s /etc/nginx/sites-available/app.bankdex.io /etc/nginx/sites-enabled/

# بررسی و reload
sudo nginx -t
sudo systemctl reload nginx
```

### 5. تنظیم SSL
```bash
# نصب Certbot
sudo apt install -y certbot python3-certbot-nginx

# دریافت گواهینامه
sudo certbot --nginx -d app.bankdex.io
```

### 6. راه‌اندازی با PM2
```bash
cd /opt/proxy-server
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # اجرای دستور نمایش داده شده
```

### 7. تست
```bash
# Health Check
curl https://app.bankdex.io/health

# Info
curl https://app.bankdex.io/info

# Proxy Test
curl -X GET "https://app.bankdex.io/api/proxy" \
  -H "X-Target-URL: https://api.orderly.org/v1/ip_info"
```

---

## 🔧 دستورات مفید

### مدیریت PM2
```bash
pm2 status              # وضعیت
pm2 logs orderly-proxy  # لاگ‌ها
pm2 restart orderly-proxy  # Restart
pm2 stop orderly-proxy     # Stop
pm2 monit               # Monitoring
```

### مدیریت Nginx
```bash
sudo systemctl status nginx    # وضعیت
sudo systemctl reload nginx   # Reload
sudo nginx -t                 # تست تنظیمات
```

### بررسی لاگ‌ها
```bash
# PM2
pm2 logs orderly-proxy

# Nginx
sudo tail -f /var/log/nginx/app.bankdex.io.access.log
sudo tail -f /var/log/nginx/app.bankdex.io.error.log
```

---

## ⚠️ نکات مهم

1. **DNS**: مطمئن شوید که `app.bankdex.io` به IP سرور شما اشاره می‌کند
2. **Firewall**: پورت‌های 80 و 443 را باز کنید
3. **SSL**: بعد از تنظیم Nginx، SSL را نصب کنید
4. **CORS**: دامنه `app.bankdex.io` باید در `ALLOWED_ORIGINS` باشد

---

## 🚨 Troubleshooting

### سرور شروع نمی‌شود
```bash
pm2 logs orderly-proxy --lines 50
sudo lsof -i :3000
```

### Nginx خطا می‌دهد
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### SSL کار نمی‌کند
```bash
sudo certbot certificates
sudo certbot renew
```

---

---

## 📚 راهنمای کامل

برای راهنمای کامل استقرار (شامل Linux، Windows، Docker و ...)، فایل **[DEPLOYMENT.md](./DEPLOYMENT.md)** را مطالعه کنید.

