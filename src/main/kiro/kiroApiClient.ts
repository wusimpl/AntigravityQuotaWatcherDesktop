/**
 * Kiro API 客户端
 * 封装与 Kiro API 的交互
 */
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../logger';

const KIRO_AUTH_URL = 'https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken';
const KIRO_USAGE_URL = 'https://q.us-east-1.amazonaws.com/getUsageLimits';
const API_TIMEOUT_MS = 30000;

export interface KiroUsageLimits {
  used: number;
  limit: number;
  remaining: number;
}

export class KiroApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = 'KiroApiError';
  }

  isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429;
  }

  needsReauth(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }
}

export class KiroApiClient {
  private static instance: KiroApiClient;
  private proxyUrl: string | null = null;

  private constructor() {}

  static getInstance(): KiroApiClient {
    if (!KiroApiClient.instance) {
      KiroApiClient.instance = new KiroApiClient();
    }
    return KiroApiClient.instance;
  }

  /**
   * 设置代理 URL
   */
  setProxyUrl(proxyUrl: string | null): void {
    this.proxyUrl = proxyUrl && proxyUrl.trim() ? proxyUrl.trim() : null;
    logger.info(`[KiroAPI] Proxy URL set to: ${this.proxyUrl || '(none)'}`);
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /**
   * 刷新 access token
   */
  async refreshToken(refreshToken: string): Promise<string> {
    logger.info('[KiroAPI] Refreshing access token...');

    const response = await this.httpPost(
      KIRO_AUTH_URL,
      { 'Content-Type': 'application/json' },
      JSON.stringify({ refreshToken })
    );

    if (response.status !== 200) {
      throw new KiroApiError(
        `Token refresh failed: ${response.body}`,
        response.status
      );
    }

    const data = JSON.parse(response.body);
    logger.info('[KiroAPI] Token refreshed successfully');
    return data.accessToken;
  }

  /**
   * 获取 Usage Limits (Credits)
   */
  async getUsageLimits(accessToken: string, profileArn: string): Promise<KiroUsageLimits> {
    logger.info('[KiroAPI] Fetching usage limits...');

    // 构建 URL 参数 - 使用 AGENTIC_REQUEST 作为主要资源类型
    const params = new URLSearchParams({
      isEmailRequired: 'true',
      origin: 'AI_EDITOR',
      resourceType: 'AGENTIC_REQUEST',
      profileArn: profileArn
    });

    const fullUrl = `${KIRO_USAGE_URL}?${params.toString()}`;

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-amz-user-agent': 'aws-sdk-js/1.0.0 KiroIDE-0.7.5',
      'user-agent': 'aws-sdk-js/1.0.0 ua/2.1 os/windows lang/js api/codewhispererruntime#1.0.0 KiroIDE-0.7.5',
      'amz-sdk-invocation-id': this.generateUUID(),
      'amz-sdk-request': 'attempt=1; max=1',
    };

    const response = await this.httpGet(fullUrl, headers);

    if (response.status !== 200) {
      throw new KiroApiError(
        `Failed to get usage limits: ${response.body}`,
        response.status
      );
    }

    const data = JSON.parse(response.body);
    logger.info('[KiroAPI] Usage limits response:', JSON.stringify(data));

    // 解析响应数据
    // 实际响应格式: { usageBreakdownList: [{ currentUsage, usageLimit, resourceType: "CREDIT", ... }] }
    let used = 0;
    let limit = 500;

    if (data.usageBreakdownList && Array.isArray(data.usageBreakdownList)) {
      // 查找 CREDIT 类型的使用数据
      const creditUsage = data.usageBreakdownList.find(
        (item: { resourceType?: string }) => item.resourceType === 'CREDIT'
      );
      if (creditUsage) {
        used = creditUsage.currentUsage ?? 0;
        limit = creditUsage.usageLimit ?? 500;
      }
    } else {
      // 兼容旧格式
      used = data.used ?? data.usedCredits ?? 0;
      limit = data.limit ?? data.totalCredits ?? 500;
    }

    const remaining = limit - used;

    logger.info(`[KiroAPI] Credits: ${remaining}/${limit} (used: ${used})`);

    return {
      used,
      limit,
      remaining,
    };
  }

  /**
   * HTTP GET 请求
   */
  private httpGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: headers,
        timeout: API_TIMEOUT_MS,
      };

      if (this.proxyUrl) {
        try {
          options.agent = new HttpsProxyAgent(this.proxyUrl);
        } catch (error) {
          logger.error('[KiroAPI] Failed to create proxy agent:', (error as Error).message);
        }
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      });

      req.on('error', (error) => {
        logger.error('[KiroAPI] HTTP GET error:', error.message);
        reject(error);
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  /**
   * HTTP POST 请求
   */
  private httpPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: API_TIMEOUT_MS,
      };

      if (this.proxyUrl) {
        try {
          options.agent = new HttpsProxyAgent(this.proxyUrl);
        } catch (error) {
          logger.error('[KiroAPI] Failed to create proxy agent:', (error as Error).message);
        }
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
      });

      req.on('error', (error) => {
        logger.error('[KiroAPI] HTTP POST error:', error.message);
        reject(error);
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(body);
      req.end();
    });
  }
}
