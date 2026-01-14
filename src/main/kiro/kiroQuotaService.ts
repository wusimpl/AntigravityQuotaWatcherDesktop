/**
 * Kiro 配额服务
 * 管理 Kiro Credits 的轮询和获取
 */
import { KiroAuthService } from './kiroAuthService';
import { KiroApiClient, KiroUsageLimits, KiroApiError } from './kiroApiClient';
import { logger } from '../logger';

export interface KiroQuotaSnapshot {
  timestamp: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;  // 剩余百分比 0-100
}

export type KiroQuotaUpdateCallback = (snapshot: KiroQuotaSnapshot) => void;
export type KiroQuotaErrorCallback = (error: Error) => void;
export type KiroQuotaStatusCallback = (status: 'fetching' | 'retrying' | 'idle', retryCount?: number) => void;

const DEFAULT_POLLING_INTERVAL_MS = 60_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5_000;

export class KiroQuotaService {
  private static instance: KiroQuotaService;

  private authService: KiroAuthService;
  private apiClient: KiroApiClient;
  private pollingInterval: number;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private retryCount = 0;

  // 缓存配额数据
  private quotaCache: KiroQuotaSnapshot | null = null;
  private currentAccessToken: string | null = null;

  // 回调
  private updateCallback: KiroQuotaUpdateCallback | null = null;
  private errorCallback: KiroQuotaErrorCallback | null = null;
  private statusCallback: KiroQuotaStatusCallback | null = null;

  private constructor(pollingInterval?: number) {
    this.authService = KiroAuthService.getInstance();
    this.apiClient = KiroApiClient.getInstance();
    this.pollingInterval = pollingInterval || DEFAULT_POLLING_INTERVAL_MS;
  }

  static getInstance(pollingInterval?: number): KiroQuotaService {
    if (!KiroQuotaService.instance) {
      KiroQuotaService.instance = new KiroQuotaService(pollingInterval);
    } else if (pollingInterval !== undefined) {
      KiroQuotaService.instance.setPollingInterval(pollingInterval);
    }
    return KiroQuotaService.instance;
  }

  /** 设置轮询间隔 */
  setPollingInterval(intervalMs: number): void {
    this.pollingInterval = intervalMs;
    if (this.isPolling) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /** 设置代理 */
  setProxyUrl(proxyUrl: string | null): void {
    this.apiClient.setProxyUrl(proxyUrl);
  }

  /** 注册配额更新回调 */
  onQuotaUpdate(callback: KiroQuotaUpdateCallback): void {
    this.updateCallback = callback;
  }

  /** 注册错误回调 */
  onError(callback: KiroQuotaErrorCallback): void {
    this.errorCallback = callback;
  }

  /** 注册状态回调 */
  onStatus(callback: KiroQuotaStatusCallback): void {
    this.statusCallback = callback;
  }

  /** 启动轮询 */
  async startPolling(): Promise<void> {
    if (this.isPolling) return;

    if (!this.authService.isAuthenticated()) {
      logger.info('[KiroQuota] Not authenticated, skipping polling');
      return;
    }

    logger.info(`[KiroQuota] Starting polling (interval: ${this.pollingInterval}ms)`);
    this.isPolling = true;

    // 立即获取一次
    await this.fetchQuota();

    // 设置定时器
    this.pollingTimer = setInterval(() => {
      this.fetchQuota();
    }, this.pollingInterval);
  }

  /** 停止轮询 */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
    this.retryCount = 0;
    this.statusCallback?.('idle');
    logger.info('[KiroQuota] Polling stopped');
  }

  /** 立即刷新配额 */
  async refreshNow(): Promise<void> {
    await this.fetchQuota();
  }

  /** 获取缓存的配额数据 */
  getCachedQuota(): KiroQuotaSnapshot | null {
    return this.quotaCache;
  }

  /** 检查是否已认证 */
  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  /** 重新加载认证信息 */
  async reloadAuth(): Promise<boolean> {
    return this.authService.reload();
  }

  /** 获取认证状态 */
  getAuthState() {
    return this.authService.getAuthState();
  }

  /** 获取配额 */
  private async fetchQuota(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      logger.info('[KiroQuota] Not authenticated, skipping fetch');
      return;
    }

    this.statusCallback?.('fetching');

    try {
      // 获取 refresh token 和 profile ARN
      const refreshToken = this.authService.getRefreshToken();
      const profileArn = this.authService.getProfileArn();

      if (!refreshToken || !profileArn) {
        throw new Error('Missing refresh token or profile ARN');
      }

      // 刷新 access token
      const accessToken = await this.apiClient.refreshToken(refreshToken);
      this.currentAccessToken = accessToken;
      this.authService.updateAccessToken(accessToken);

      // 获取 usage limits
      const limits = await this.apiClient.getUsageLimits(accessToken, profileArn);

      // 构建快照
      const snapshot: KiroQuotaSnapshot = {
        timestamp: new Date().toISOString(),
        used: limits.used,
        limit: limits.limit,
        remaining: limits.remaining,
        percentage: limits.limit > 0 ? (limits.remaining / limits.limit) * 100 : 0,
      };

      this.quotaCache = snapshot;
      this.updateCallback?.(snapshot);
      this.retryCount = 0;
      this.statusCallback?.('idle');

      logger.info(`[KiroQuota] Quota fetched: ${limits.remaining}/${limits.limit}`);
    } catch (error) {
      await this.handleFetchError(error as Error);
    }
  }

  /** 处理获取错误 */
  private async handleFetchError(error: Error): Promise<void> {
    logger.error('[KiroQuota] Fetch error:', error.message);

    // 认证错误，停止轮询
    if (error instanceof KiroApiError && error.needsReauth()) {
      logger.warn('[KiroQuota] Authentication error, stopping polling');
      this.stopPolling();
      this.errorCallback?.(error);
      return;
    }

    // 不可重试的错误
    if (error instanceof KiroApiError && !error.isRetryable()) {
      logger.warn('[KiroQuota] Non-retryable error');
      this.errorCallback?.(error);
      this.statusCallback?.('idle');
      return;
    }

    // 可重试错误
    if (this.retryCount < MAX_RETRIES) {
      this.retryCount++;
      this.statusCallback?.('retrying', this.retryCount);
      logger.info(`[KiroQuota] Retry ${this.retryCount}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms`);

      await this.delay(RETRY_DELAY_MS);

      try {
        await this.fetchQuota();
      } catch (retryError) {
        // 递归调用以继续重试或最终报错
        await this.handleFetchError(retryError as Error);
      }
    } else {
      logger.error(`[KiroQuota] Max retries (${MAX_RETRIES}) reached`);
      this.retryCount = 0;
      this.errorCallback?.(error);
      this.statusCallback?.('idle');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 清理资源 */
  dispose(): void {
    this.stopPolling();
    this.quotaCache = null;
    this.currentAccessToken = null;
    this.updateCallback = null;
    this.errorCallback = null;
    this.statusCallback = null;
  }
}
