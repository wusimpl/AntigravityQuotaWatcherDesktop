/**
 * OAuth 回调 HTTP 服务器
 * 启动临时本地服务器接收 Google OAuth 回调
 */
import * as http from 'http';
import { CALLBACK_HOST, CALLBACK_PATH, AUTH_TIMEOUT_MS } from './constants';

export interface CallbackResult {
  code: string;
  state?: string;
}

export class CallbackServer {
  private server: http.Server | null = null;
  private port: number = 0;

  getRedirectUri(): string {
    if (this.port === 0) throw new Error('Server not started');
    return `http://${CALLBACK_HOST}:${this.port}${CALLBACK_PATH}`;
  }

  startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer();

      this.server.listen(0, CALLBACK_HOST, () => {
        const address = this.server!.address();
        if (typeof address === 'object' && address !== null) {
          this.port = address.port;
          console.log(`[CallbackServer] Listening on port ${this.port}`);
          resolve();
        } else {
          reject(new Error('Failed to get server address'));
        }
      });

      this.server.on('error', reject);
    });
  }

  waitForCallback(expectedState: string): Promise<CallbackResult> {
    if (this.port === 0) {
      return Promise.reject(new Error('Server not started'));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stop();
        reject(new Error('OAuth callback timeout'));
      }, AUTH_TIMEOUT_MS);

      this.server!.on('request', (req, res) => {
        const url = new URL(req.url || '', `http://${CALLBACK_HOST}`);

        if (url.pathname !== CALLBACK_PATH) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        clearTimeout(timeout);

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.getErrorHtml(error, errorDescription || 'Unknown error'));
          this.stop();
          reject(new Error(`OAuth error: ${error} - ${errorDescription}`));
          return;
        }

        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.getErrorHtml('missing_code', 'No authorization code'));
          this.stop();
          reject(new Error('No authorization code received'));
          return;
        }

        if (state !== expectedState) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.getErrorHtml('invalid_state', 'Invalid state parameter'));
          this.stop();
          reject(new Error('Invalid state parameter (CSRF protection)'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.getSuccessHtml());
        this.stop();
        resolve({ code, state });
      });
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.port = 0;
    }
  }

  private getSuccessHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录成功 - AG Quota Desktop</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      max-width: 400px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg { width: 32px; height: 32px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>登录成功</h1>
    <p>您可以关闭此页面并返回 AG Quota Desktop。</p>
    <p style="margin-top: 8px;">Login successful. You can close this page.</p>
  </div>
</body>
</html>`;
  }

  private getErrorHtml(error: string, description: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录失败 - AG Quota Desktop</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      max-width: 400px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg { width: 32px; height: 32px; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.7); line-height: 1.6; }
    .error-code {
      background: rgba(255,255,255,0.1);
      padding: 8px 16px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </div>
    <h1>登录失败</h1>
    <p>${this.escapeHtml(description)}</p>
    <div class="error-code">错误代码: ${this.escapeHtml(error)}</div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
