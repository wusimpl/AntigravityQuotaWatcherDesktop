/**
 * 等待 Vite 和 TypeScript 编译完成后启动 Electron
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const VITE_URL = 'http://localhost:5173';
const MAIN_JS = path.join(__dirname, '../dist/main/main/index.js');
const CHECK_INTERVAL = 500;
const MAX_WAIT = 30000;

async function checkVite() {
  return new Promise((resolve) => {
    http.get(VITE_URL, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

function checkMainJs() {
  return fs.existsSync(MAIN_JS);
}

async function waitForReady() {
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT) {
    const viteReady = await checkVite();
    const mainReady = checkMainJs();
    
    if (viteReady && mainReady) {
      console.log('[dev:electron] Vite and main process ready, starting Electron...');
      return true;
    }
    
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
  
  console.error('[dev:electron] Timeout waiting for dev servers');
  return false;
}

async function main() {
  console.log('[dev:electron] Waiting for Vite and TypeScript...');
  
  const ready = await waitForReady();
  if (!ready) {
    process.exit(1);
  }
  
  // 启动 Electron
  const electron = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  electron.on('close', (code) => {
    process.exit(code);
  });
}

main();
