/**
 * 等待 Vite 和 TypeScript 编译完成后启动 Electron
 * 增加了更健壮的等待逻辑，避免 esbuild service 未就绪的问题
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const VITE_URL = 'http://localhost:5173';
const MAIN_JS = path.join(__dirname, '../dist/main/main/index.js');
const CHECK_INTERVAL = 500;
const MAX_WAIT = 60000;
// Vite 就绪后额外等待时间，确保 esbuild 完全初始化
const EXTRA_WAIT_AFTER_READY = 1500;
// 需要连续成功检测的次数，确保服务稳定
const STABLE_CHECK_COUNT = 3;

async function checkVite() {
  return new Promise((resolve) => {
    const req = http.get(VITE_URL, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function checkMainJs() {
  return fs.existsSync(MAIN_JS);
}

async function waitForReady() {
  const startTime = Date.now();
  let stableCount = 0;
  
  console.log('[dev:electron] Waiting for Vite and TypeScript...');
  
  while (Date.now() - startTime < MAX_WAIT) {
    const viteReady = await checkVite();
    const mainReady = checkMainJs();
    
    if (viteReady && mainReady) {
      stableCount++;
      if (stableCount >= STABLE_CHECK_COUNT) {
        console.log('[dev:electron] Services stable, waiting for esbuild to fully initialize...');
        // 额外等待确保 esbuild 完全就绪
        await new Promise(r => setTimeout(r, EXTRA_WAIT_AFTER_READY));
        console.log('[dev:electron] Starting Electron...');
        return true;
      }
    } else {
      stableCount = 0;
    }
    
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
  
  console.error('[dev:electron] Timeout waiting for dev servers');
  return false;
}

async function main() {
  const ready = await waitForReady();
  if (!ready) {
    process.exit(1);
  }
  
  // 获取 electron 可执行文件路径，避免使用 shell: true
  const electronPath = require('electron');
  
  // 启动 Electron - 不使用 shell: true，直接启动 electron
  const electronProcess = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  // 清理函数
  function cleanup() {
    console.log('[dev:electron] Cleaning up...');
    if (electronProcess && !electronProcess.killed) {
      // Windows 上使用 taskkill 强制终止进程树
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', electronProcess.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
      } else {
        electronProcess.kill('SIGTERM');
      }
    }
  }
  
  // 监听退出信号
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });
  
  // Windows 特殊处理：监听 message 事件（concurrently 可能通过这种方式通知）
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      cleanup();
      process.exit(0);
    }
  });
  
  electronProcess.on('close', (code) => {
    process.exit(code);
  });
}

main();
