/**
 * Google Cloud Code API 客户端
 * 封装与 Google Cloud Code API 的交互
 */
import * as https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  CLOUD_CODE_API_BASE,
  LOAD_CODE_ASSIST_PATH,
  FETCH_AVAILABLE_MODELS_PATH,
  API_TIMEOUT_MS,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  DEFAULT_PROJECT_ID,
} from '../constants';

const DEBUG_ENABLED = process.env.AG_QUOTA_DEBUG === '1';
const debugLog = (...args: unknown[]): void => {
  if (DEBUG_ENABLED) console.log(...args);
};

/**
 * 项目信息 (loadCodeAssist 响应)
 */
export interface ProjectInfo {
  projectId: string;
  tier: string;  // 'FREE', 'PRO', 'TEAMS' 等
}

/**
 * 模型配额信息 (单个模型)
 */
export interface ModelQuotaFromApi {
  modelName: string;
  displayName: string;
  remainingQuota: number;  // 0-1 之间的小数
  resetTime: string;       // ISO 8601 格式
  isExhausted: boolean;
}

/**
 * 模型配额列表 (fetchAvailableModels 响应)
 */
export interface ModelsQuotaResponse {
  models: ModelQuotaFromApi[];
}

/**
 * API 错误类
 */
export class GoogleApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }

  /** 是否可以重试 */
  isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429;
  }

  /** 是否需要重新登录 */
  needsReauth(): boolean {
    return this.statusCode === 401;
  }
}


/**
 * Google Cloud Code API 客户端
 */
export class GoogleCloudCodeClient {
  private static instance: GoogleCloudCodeClient;
  private proxyUrl: string | null = null;

  private constructor() { }

  static getInstance(): GoogleCloudCodeClient {
    if (!GoogleCloudCodeClient.instance) {
      GoogleCloudCodeClient.instance = new GoogleCloudCodeClient();
    }
    return GoogleCloudCodeClient.instance;
  }

  /**
   * 设置代理 URL
   * @param proxyUrl 代理 URL，如 "http://127.0.0.1:7890"，传 null 或空字符串表示不使用代理
   */
  setProxyUrl(proxyUrl: string | null): void {
    this.proxyUrl = proxyUrl && proxyUrl.trim() ? proxyUrl.trim() : null;
    debugLog(`[GoogleAPI] Proxy URL set to: ${this.proxyUrl || '(none)'}`);
  }

  /**
   * 获取当前代理 URL
   */
  getProxyUrl(): string | null {
    return this.proxyUrl;
  }

  /**
   * 获取项目信息和订阅等级
   */
  async loadProjectInfo(accessToken: string): Promise<ProjectInfo> {
    debugLog('[GoogleAPI] loadProjectInfo: Sending request...');
    const requestBody = {
      metadata: { ideType: 'ANTIGRAVITY' }
    };
    debugLog('[GoogleAPI] loadProjectInfo: Request body:', JSON.stringify(requestBody));

    const response = await this.makeApiRequest(
      LOAD_CODE_ASSIST_PATH,
      accessToken,
      requestBody
    );

    debugLog('[GoogleAPI] loadProjectInfo: Raw response:', JSON.stringify(response));

    const paidTier = (response.paidTier || {}) as Record<string, unknown>;
    const currentTier = (response.currentTier || {}) as Record<string, unknown>;
    const tier = (paidTier.id as string) || (currentTier.id as string) || 'FREE';

    const result = {
      projectId: (response.cloudaicompanionProject as string) || '',
      tier,
    };
    debugLog('[GoogleAPI] loadProjectInfo: Parsed result:', JSON.stringify(result));

    return result;
  }

  /**
   * 获取模型配额列表
   */
  async fetchModelsQuota(
    accessToken: string,
    projectId?: string
  ): Promise<ModelsQuotaResponse> {
    const effectiveProjectId = projectId || DEFAULT_PROJECT_ID;
    if (!effectiveProjectId) {
      throw new Error('Missing projectId (ensure loadProjectInfo returns it, or set AG_QUOTA_DEFAULT_PROJECT_ID)');
    }

    const body = {
      project: effectiveProjectId,
    };
    debugLog('[GoogleAPI] fetchModelsQuota: Request body:', JSON.stringify(body));

    const response = await this.makeApiRequest(
      FETCH_AVAILABLE_MODELS_PATH,
      accessToken,
      body
    );

    debugLog('[GoogleAPI] fetchModelsQuota: Raw response keys:', Object.keys(response));

    const modelsMap = response.models || {};
    const modelNames = Object.keys(modelsMap);
    debugLog('[GoogleAPI] fetchModelsQuota: Found models in response:', modelNames.join(', ') || '(none)');

    const models: ModelQuotaFromApi[] = [];
    const allowedModelPatterns = /gemini|claude|gpt/i;

    for (const [modelName, modelInfo] of Object.entries(modelsMap)) {
      if (!allowedModelPatterns.test(modelName)) {
        debugLog(`[GoogleAPI] fetchModelsQuota: Model "${modelName}" filtered out (not gemini/claude/gpt)`);
        continue;
      }
      if (!this.isModelVersionSupported(modelName)) {
        debugLog(`[GoogleAPI] fetchModelsQuota: Model "${modelName}" filtered out (Gemini version < 3.0)`);
        continue;
      }

      const info = modelInfo as Record<string, unknown>;
      if (info.quotaInfo) {
        const parsed = this.parseModelQuota(modelName, info);
        debugLog(`[GoogleAPI] fetchModelsQuota: Model "${modelName}" -> remaining: ${parsed.remainingQuota * 100}%`);
        models.push(parsed);
      } else {
        debugLog(`[GoogleAPI] fetchModelsQuota: Model "${modelName}" has no quotaInfo, skipping`);
      }
    }

    debugLog('[GoogleAPI] fetchModelsQuota: Total models with quota:', models.length);
    return { models };
  }

  private parseModelQuota(modelName: string, modelInfo: Record<string, unknown>): ModelQuotaFromApi {
    const quotaInfo = (modelInfo.quotaInfo || {}) as Record<string, unknown>;
    const remainingFraction = (quotaInfo.remainingFraction as number) ?? 0;

    return {
      modelName,
      displayName: this.formatModelDisplayName(modelName),
      remainingQuota: typeof remainingFraction === 'number' ? remainingFraction : 0,
      resetTime: (quotaInfo.resetTime as string) || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      isExhausted: remainingFraction <= 0,
    };
  }

  private formatModelDisplayName(modelName: string): string {
    const fixedModelName = modelName.replace(/(\d+)-(\d+)/g, '$1.$2');
    return fixedModelName
      .split('-')
      .map(part => /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private isModelVersionSupported(modelName: string): boolean {
    const lowerName = modelName.toLowerCase();
    if (!lowerName.includes('gemini')) return true;

    const versionMatch = lowerName.match(/gemini-(\d+(?:\.\d+)?)/);
    if (versionMatch && versionMatch[1]) {
      return parseFloat(versionMatch[1]) >= 3.0;
    }
    return false;
  }


  private async makeApiRequest(
    path: string,
    accessToken: string,
    body: object
  ): Promise<Record<string, unknown>> {
    let lastError: Error | null = null;
    debugLog(`[GoogleAPI] makeApiRequest: ${path} (max retries: ${MAX_RETRIES})`);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        debugLog(`[GoogleAPI] makeApiRequest: Attempt ${attempt + 1}/${MAX_RETRIES}`);
        return await this.doRequest(path, accessToken, body);
      } catch (e) {
        lastError = e as Error;
        console.error(`[GoogleAPI] makeApiRequest: Attempt ${attempt + 1} failed:`, lastError.message);

        if (e instanceof GoogleApiError) {
          debugLog(`[GoogleAPI] makeApiRequest: GoogleApiError - status: ${e.statusCode}, retryable: ${e.isRetryable()}, needsReauth: ${e.needsReauth()}`);
          if (!e.isRetryable() || e.needsReauth()) throw e;
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAY_MS * (attempt + 1);
          debugLog(`[GoogleAPI] makeApiRequest: Waiting ${delay}ms before retry...`);
          await this.delay(delay);
        }
      }
    }

    console.error('[GoogleAPI] makeApiRequest: All retries exhausted');
    throw lastError || new Error('Request failed after retries');
  }

  private doRequest(
    path: string,
    accessToken: string,
    body: object
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const url = new URL(CLOUD_CODE_API_BASE);
      const postData = JSON.stringify(body);

      debugLog(`[GoogleAPI] doRequest: POST ${url.hostname}${path}`);
      debugLog(`[GoogleAPI] doRequest: Body length: ${postData.length} bytes`);
      debugLog(`[GoogleAPI] doRequest: Token length: ${accessToken.length}`);
      debugLog(`[GoogleAPI] doRequest: Proxy: ${this.proxyUrl || '(none)'}`);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path,
        method: 'POST',
        timeout: API_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Antigravity/1.11',
        },
      };

      // 如果设置了代理，使用代理 agent
      if (this.proxyUrl) {
        try {
          options.agent = new HttpsProxyAgent(this.proxyUrl);
          debugLog(`[GoogleAPI] doRequest: Using proxy agent`);
        } catch (proxyError) {
          console.error(`[GoogleAPI] doRequest: Failed to create proxy agent:`, proxyError);
        }
      }

      const req = https.request(options, (res) => {
        let data = '';
        debugLog(`[GoogleAPI] doRequest: Response status: ${res.statusCode}`);

        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          debugLog(`[GoogleAPI] doRequest: Response body length: ${data.length} bytes`);

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              debugLog('[GoogleAPI] doRequest: Success');
              resolve(response);
            } catch {
              console.error('[GoogleAPI] doRequest: Failed to parse JSON response');
              reject(new Error(`Failed to parse API response: ${data}`));
            }
          } else {
            let errorMessage = `API request failed with status ${res.statusCode}`;
            let errorCode: string | undefined;
            try {
              const errorResponse = JSON.parse(data);
              errorMessage = errorResponse.error?.message || errorResponse.message || errorMessage;
              errorCode = errorResponse.error?.code || errorResponse.code;
              console.error(`[GoogleAPI] doRequest: Error response:`, JSON.stringify(errorResponse));
            } catch {
              console.error(`[GoogleAPI] doRequest: Raw error response: ${data}`);
            }
            reject(new GoogleApiError(errorMessage, res.statusCode || 500, errorCode));
          }
        });
      });

      req.on('error', (e) => {
        console.error(`[GoogleAPI] doRequest: Network error: ${e.message}`);
        reject(new Error(`Network error: ${e.message}`));
      });
      req.on('timeout', () => {
        console.error(`[GoogleAPI] doRequest: Request timeout after ${API_TIMEOUT_MS}ms`);
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /** 遮蔽 token，只显示前6位和后4位 */
  private maskToken(token: string): string {
    if (token.length <= 14) return '***';
    return `${token.substring(0, 6)}***${token.substring(token.length - 4)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
