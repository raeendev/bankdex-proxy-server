/**
 * PM2 Configuration
 * برای اجرای سرور proxy در production با PM2
 * 
 * نصب PM2: npm install -g pm2
 * اجرا: pm2 start ecosystem.config.js
 * مشاهده لاگ: pm2 logs
 * توقف: pm2 stop orderly-proxy
 */

module.exports = {
  apps: [{
    name: 'orderly-proxy',
    script: './server.js',
    instances: 2, // تعداد instance ها (برای load balancing)
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      ALLOWED_ORIGINS: ''
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      ALLOWED_ORIGINS: 'https://bankdex.io,https://www.bankdex.io,https://app.bankdex.io'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10
  }]
};

