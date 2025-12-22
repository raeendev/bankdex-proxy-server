# راهنمای Deploy کردن Proxy Server

## 🚀 روش‌های Deployment

### 1. Deploy با PM2 (پیشنهادی برای VPS)

#### نصب PM2:

```bash
npm install -g pm2
```

#### اجرای سرور:

```bash
# Development
pm2 start ecosystem.config.js --env development

# Production
pm2 start ecosystem.config.js --env production
```

#### دستورات مفید PM2:

```bash
# مشاهده وضعیت
pm2 status

# مشاهده لاگ‌ها
pm2 logs orderly-proxy

# Restart
pm2 restart orderly-proxy

# Stop
pm2 stop orderly-proxy

# Delete
pm2 delete orderly-proxy

# Save configuration
pm2 save

# Startup script (برای auto-start بعد از reboot)
pm2 startup
```

### 2. Deploy با Docker

#### ساخت Image:

```bash
docker build -t orderly-proxy .
```

#### اجرای Container:

```bash
docker run -d \
  --name orderly-proxy \
  -p 3000:3000 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e ALLOWED_ORIGINS=https://bankdex.io,https://www.bankdex.io \
  --restart unless-stopped \
  orderly-proxy
```

#### با Docker Compose:

```bash
# ویرایش docker-compose.yml و تنظیم environment variables
docker-compose up -d
```

### 3. Deploy با systemd (Linux)

#### ایجاد فایل service:

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
User=nodejs
WorkingDirectory=/path/to/proxy-server
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ALLOWED_ORIGINS=https://bankdex.io
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### فعال‌سازی و اجرا:

```bash
sudo systemctl daemon-reload
sudo systemctl enable orderly-proxy
sudo systemctl start orderly-proxy
sudo systemctl status orderly-proxy
```

### 4. Deploy با Nginx Reverse Proxy

#### تنظیم Nginx:

```nginx
server {
    listen 80;
    server_name proxy.bankdex.io;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name proxy.bankdex.io;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 SSL/TLS Configuration

### با Let's Encrypt (Certbot):

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# برای Nginx
sudo certbot --nginx -d proxy.bankdex.io

# برای standalone
sudo certbot certonly --standalone -d proxy.bankdex.io
```

## 📊 Monitoring

### با PM2:

```bash
# مشاهده metrics
pm2 monit
```

### با Docker:

```bash
# مشاهده stats
docker stats orderly-proxy
```

## 🔍 Troubleshooting

### بررسی لاگ‌ها:

```bash
# PM2
pm2 logs orderly-proxy

# Docker
docker logs orderly-proxy

# systemd
sudo journalctl -u orderly-proxy -f
```

### بررسی Port:

```bash
# بررسی اینکه port 3000 در حال استفاده است
netstat -tulpn | grep 3000
# یا
lsof -i :3000
```

### تست Health Check:

```bash
curl http://localhost:3000/health
```

## 📝 Checklist قبل از Deploy

- [ ] فایل `.env` را تنظیم کرده‌اید
- [ ] `ALLOWED_ORIGINS` را برای production تنظیم کرده‌اید
- [ ] SSL certificate نصب شده است
- [ ] Firewall rules تنظیم شده است
- [ ] Monitoring setup شده است
- [ ] Backup strategy در نظر گرفته شده است

## 🌐 تنظیم در Frontend

بعد از deploy، در فایل `public/config.js` پروژه frontend:

```javascript
window.__RUNTIME_CONFIG__ = {
  // ...
  "VITE_API_PROXY_URL": "https://proxy.bankdex.io/api/proxy"
};
```

