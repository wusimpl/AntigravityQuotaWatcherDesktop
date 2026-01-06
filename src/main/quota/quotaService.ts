/**
 * 配额服务
 * 管理配额轮询、多账户配额获取
 */
import { GoogleAuthService, AuthState } from '../auth';
import { GoogleCloudCodeClient, GoogleApiError } from '../../shared/api';
import { QuotaSnapshot, ModelQuotaInfo } from '../../shared/types';

export interface QuotaServiceOptions {
  pollingInterval: number;  // 轮询间隔（毫秒）
}

export type QuotaUpdateCallback = (accountId: string, snapshot: QuotaSnapshot) => void;
export type QuotaErrorCallback = (accountId: string, error: Error) => void;
export type QuotaStatusCallback = (status: 'fetching' | 'retrying' | 'idle', retryCount?: number) => void;

const DEFAULT_POLLING_INTERVAL = 60000; // 60 秒
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export class QuotaService {
  private static instance: QuotaService;
  
  private authService: GoogleAuthService;
  private apiClient: GoogleCloudCodeClient;
  private pollingInterval: number;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private retryCount = 0;
  
  // 缓存每个账户的配额数据
  private quotaCache: Map<string, QuotaSnapshot> = new Map();
  
  // 回调
  private updateCallback: QuotaUpdateCallback | null = null;
  private errorCallback: QuotaErrorCallback | null = null;
  private statusCallback: QuotaStatusCallback | null = null;

  private constructor(options?: Partial<QuotaServiceOptions>) {
    this.authService = GoogleAuthService.getInstance();
    this.apiClient = GoogleCloudCodeClient.getInstance();
    this.pollingInterval = options?.pollingInterval || DEFAULT_POLLING_INTERVAL;
  }

  static getInstance(options?: Partial<QuotaServiceOptions>): QuotaService {
    if (!QuotaService.instance) {
      QuotaService.instance = new QuotaService(options);
    }
    return QuotaService.instance;
  }

  /** 设置轮询间隔 */
  setPollingInterval(intervalMs: number): void {
    this.pollingInterval = intervalMs;
    if (this.isPolling) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /** 注册配额更新回调 */
  onQuotaUpdate(callback: QuotaUpdateCallback): void {
    this.updateCallback = callback;
  }

  /** 注册错误回调 */
  onError(callback: QuotaErrorCallback): void {
    this.errorCallback = callback;
  }

  /** 注册状态回调 */
  onStatus(callback: QuotaStatusCallback): void {
    this.statusCallback = callback;
  }


  /** 启动轮询 */
  async startPolling(): Promise<void> {
    if (this.isPolling) return;

    const authState = this.authService.getAuthState();
    if (authState.state !== AuthState.AUTHENTICATED) {
      console.log('[QuotaService] Not authenticated, skipping polling');
      return;
    }

    console.log(`[QuotaService] Starting polling (interval: ${this.pollingInterval}ms)`);
    this.isPolling = true;
    
    // 立即获取一次
    await this.fetchAllAccountsQuota();
    
    // 设置定时器
    this.pollingTimer = setInterval(() => {
      this.fetchAllAccountsQuota();
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
    console.log('[QuotaService] Polling stopped');
  }

  /** 立即刷新配额 */
  async refreshNow(): Promise<void> {
    await this.fetchAllAccountsQuota();
  }

  /** 获取缓存的配额数据 */
  getCachedQuota(accountId: string): QuotaSnapshot | undefined {
    return this.quotaCache.get(accountId);
  }

  /** 获取当前活跃账户的配额 */
  async getActiveAccountQuota(): Promise<QuotaSnapshot | null> {
    const activeAccount = await this.authService.getActiveAccount();
    if (!activeAccount) return null;
    return this.quotaCache.get(activeAccount.id) || null;
  }

  /** 获取所有账户的配额 */
  getAllCachedQuotas(): Map<string, QuotaSnapshot> {
    return new Map(this.quotaCache);
  }


  /** 获取所有账户的配额 */
  private async fetchAllAccountsQuota(): Promise<void> {
    const accounts = await this.authService.getAccounts();
    if (accounts.length === 0) {
      console.log('[QuotaService] No accounts, skipping fetch');
      return;
    }

    this.statusCallback?.('fetching');

    for (const account of accounts) {
      try {
        const snapshot = await this.fetchAccountQuota(account.id, account.email);
        this.quotaCache.set(account.id, snapshot);
        this.updateCallback?.(account.id, snapshot);
        this.retryCount = 0;
      } catch (error) {
        await this.handleFetchError(account.id, error as Error);
      }
    }

    this.statusCallback?.('idle');
  }

  /** 获取单个账户的配额 */
  private async fetchAccountQuota(accountId: string, email: string): Promise<QuotaSnapshot> {
    console.log(`[QuotaService] Fetching quota for: ${email}`);
    
    const accessToken = await this.authService.getValidAccessToken(accountId);
    
    // 获取项目信息
    const projectInfo = await this.apiClient.loadProjectInfo(accessToken);
    console.log(`[QuotaService] Project tier: ${projectInfo.tier}`);
    
    // 获取模型配额
    const modelsQuota = await this.apiClient.fetchModelsQuota(accessToken, projectInfo.projectId);
    
    // 转换为 QuotaSnapshot
    const models: ModelQuotaInfo[] = modelsQuota.models.map((model) => ({
      modelId: model.modelName,
      displayName: model.displayName,
      remainingFraction: model.remainingQuota,
      remainingPercentage: model.remainingQuota * 100,
      isExhausted: model.isExhausted,
      resetTime: model.resetTime,
    }));

    return {
      timestamp: new Date().toISOString(),
      models,
      userEmail: email,
      tier: projectInfo.tier,
    };
  }


  /** 处理获取错误 */
  private async handleFetchError(accountId: string, error: Error): Promise<void> {
    console.error(`[QuotaService] Fetch error for ${accountId}:`, error.message);

    // 认证错误，停止轮询
    if (error instanceof GoogleApiError && error.needsReauth()) {
      console.log('[QuotaService] Auth error, stopping polling');
      this.stopPolling();
      this.errorCallback?.(accountId, error);
      return;
    }

    // 可重试错误
    if (this.retryCount < MAX_RETRIES) {
      this.retryCount++;
      this.statusCallback?.('retrying', this.retryCount);
      console.log(`[QuotaService] Retry ${this.retryCount}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms`);
      
      await this.delay(RETRY_DELAY_MS);
      
      try {
        const accounts = await this.authService.getAccounts();
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          const snapshot = await this.fetchAccountQuota(accountId, account.email);
          this.quotaCache.set(accountId, snapshot);
          this.updateCallback?.(accountId, snapshot);
          this.retryCount = 0;
        }
      } catch (retryError) {
        if (this.retryCount >= MAX_RETRIES) {
          this.errorCallback?.(accountId, retryError as Error);
        }
      }
    } else {
      this.errorCallback?.(accountId, error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 清理资源 */
  dispose(): void {
    this.stopPolling();
    this.quotaCache.clear();
    this.updateCallback = null;
    this.errorCallback = null;
    this.statusCallback = null;
  }
}
