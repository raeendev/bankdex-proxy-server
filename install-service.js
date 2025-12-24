/**
 * نصب Windows Service برای Orderly Proxy Server
 * استفاده: node install-service.js
 * 
 * نیاز: npm install -g node-windows
 */

const Service = require('node-windows').Service;
const path = require('path');

// مسیر فایل server.js
const scriptPath = path.join(__dirname, 'server.js');

// ایجاد Service
const svc = new Service({
  name: 'Orderly Proxy Server',
  description: 'Orderly Network API Proxy Server for app.bankdex.io',
  script: scriptPath,
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: 'PORT',
      value: '3000'
    },
    {
      name: 'ALLOWED_ORIGINS',
      value: 'https://app.bankdex.io,https://bankdex.io,https://www.bankdex.io'
    },
    {
      name: 'NODE_ENV',
      value: 'production'
    }
  ]
});

// Event handlers
svc.on('install', () => {
  console.log('✅ Service با موفقیت نصب شد!');
  console.log('🚀 در حال شروع Service...');
  svc.start();
});

svc.on('start', () => {
  console.log('✅ Service شروع شد!');
  console.log('📊 برای مشاهده وضعیت: services.msc');
  console.log('📝 برای مدیریت:');
  console.log('   net start "Orderly Proxy Server"  - Start');
  console.log('   net stop "Orderly Proxy Server"   - Stop');
});

svc.on('error', (err) => {
  console.error('❌ خطا:', err);
});

// نصب Service
console.log('⏳ در حال نصب Service...');
svc.install();

