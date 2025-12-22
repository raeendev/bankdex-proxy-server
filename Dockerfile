# استفاده از Node.js LTS
FROM node:20-alpine

# تنظیم working directory
WORKDIR /app

# کپی package files
COPY package*.json ./

# نصب dependencies
RUN npm ci --only=production

# کپی فایل‌های source
COPY server.js ./

# ایجاد user غیر root برای امنیت
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# تغییر ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]

