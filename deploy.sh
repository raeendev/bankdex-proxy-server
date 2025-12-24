#!/bin/bash

# اسکریپت Deploy خودکار برای app.bankdex.io
# استفاده: bash deploy.sh

set -e

echo "🚀 شروع فرآیند Deploy..."

# رنگ‌ها برای خروجی
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# بررسی Node.js
echo -e "${YELLOW}بررسی Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js نصب نشده است!${NC}"
    echo "در حال نصب Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${GREEN}Node.js نصب شده است: $(node --version)${NC}"
fi

# بررسی PM2
echo -e "${YELLOW}بررسی PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo "در حال نصب PM2..."
    sudo npm install -g pm2
else
    echo -e "${GREEN}PM2 نصب شده است${NC}"
fi

# نصب Dependencies
echo -e "${YELLOW}نصب Dependencies...${NC}"
npm install --production

# ایجاد پوشه لاگ
echo -e "${YELLOW}ایجاد پوشه لاگ...${NC}"
mkdir -p logs

# بررسی فایل .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}ایجاد فایل .env...${NC}"
    cat > .env << EOF
PORT=3000
ALLOWED_ORIGINS=https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io
NODE_ENV=production
EOF
    echo -e "${GREEN}فایل .env ایجاد شد. لطفاً آن را بررسی کنید.${NC}"
else
    echo -e "${GREEN}فایل .env موجود است${NC}"
fi

# بررسی Nginx
echo -e "${YELLOW}بررسی Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    echo "در حال نصب Nginx..."
    sudo apt update
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
else
    echo -e "${GREEN}Nginx نصب شده است${NC}"
fi

# کپی تنظیمات Nginx
if [ -f nginx-app.bankdex.io.conf ]; then
    echo -e "${YELLOW}کپی تنظیمات Nginx...${NC}"
    sudo cp nginx-app.bankdex.io.conf /etc/nginx/sites-available/app.bankdex.io
    sudo ln -sf /etc/nginx/sites-available/app.bankdex.io /etc/nginx/sites-enabled/
    
    # بررسی syntax
    if sudo nginx -t; then
        echo -e "${GREEN}تنظیمات Nginx معتبر است${NC}"
        echo -e "${YELLOW}برای اعمال تغییرات: sudo systemctl reload nginx${NC}"
    else
        echo -e "${RED}خطا در تنظیمات Nginx!${NC}"
        exit 1
    fi
fi

# راه‌اندازی با PM2
echo -e "${YELLOW}راه‌اندازی با PM2...${NC}"
pm2 delete orderly-proxy 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# بررسی وضعیت
echo -e "${GREEN}✅ Deploy با موفقیت انجام شد!${NC}"
echo ""
echo "وضعیت PM2:"
pm2 status
echo ""
echo "📝 مراحل بعدی:"
echo "1. تنظیم SSL با Let's Encrypt:"
echo "   sudo certbot --nginx -d app.bankdex.io"
echo ""
echo "2. بررسی لاگ‌ها:"
echo "   pm2 logs orderly-proxy"
echo ""
echo "3. تست Health Check:"
echo "   curl http://localhost:3000/health"

