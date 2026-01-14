/**
 * Kiro 认证服务
 * 读取本地 kiro-auth-token.json 文件获取认证信息
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export interface KiroCredentials {
  accessToken: string;
  refreshToken: string;
  profileArn: string;
  expiresAt?: number;
}

export interface KiroAuthState {
  isAuthenticated: boolean;
  profileArn?: string;
  error?: string;
}

const KIRO_AUTH_TOKEN_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.aws',
  'sso',
  'cache',
  'kiro-auth-token.json'
);

export class KiroAuthService {
  private static instance: KiroAuthService;
  private credentials: KiroCredentials | null = null;
  private authStateListeners: Array<(state: KiroAuthState) => void> = [];

  private constructor() {}

  static getInstance(): KiroAuthService {
    if (!KiroAuthService.instance) {
      KiroAuthService.instance = new KiroAuthService();
    }
    return KiroAuthService.instance;
  }

  /**
   * 初始化服务，尝试读取本地凭证
   */
  async initialize(): Promise<void> {
    logger.info('[KiroAuth] Initializing...');
    await this.loadCredentials();
  }

  /**
   * 从本地文件加载凭证
   */
  async loadCredentials(): Promise<boolean> {
    try {
      if (!fs.existsSync(KIRO_AUTH_TOKEN_PATH)) {
        logger.info('[KiroAuth] Token file not found:', KIRO_AUTH_TOKEN_PATH);
        this.credentials = null;
        this.notifyAuthStateChange();
        return false;
      }

      const content = fs.readFileSync(KIRO_AUTH_TOKEN_PATH, 'utf8');
      const data = JSON.parse(content);

      if (!data.refreshToken || !data.profileArn) {
        logger.warn('[KiroAuth] Invalid token file: missing required fields');
        this.credentials = null;
        this.notifyAuthStateChange();
        return false;
      }

      this.credentials = {
        accessToken: data.accessToken || '',
        refreshToken: data.refreshToken,
        profileArn: data.profileArn,
        expiresAt: data.expiresAt,
      };

      logger.info('[KiroAuth] Credentials loaded successfully');
      logger.info('[KiroAuth] Profile ARN:', this.credentials.profileArn);
      this.notifyAuthStateChange();
      return true;
    } catch (error) {
      logger.error('[KiroAuth] Failed to load credentials:', (error as Error).message);
      this.credentials = null;
      this.notifyAuthStateChange();
      return false;
    }
  }

  /**
   * 获取当前凭证
   */
  getCredentials(): KiroCredentials | null {
    return this.credentials;
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return this.credentials !== null && !!this.credentials.refreshToken;
  }

  /**
   * 获取认证状态
   */
  getAuthState(): KiroAuthState {
    if (!this.credentials) {
      return {
        isAuthenticated: false,
        error: 'No credentials found. Please ensure Kiro is installed and logged in.',
      };
    }
    return {
      isAuthenticated: true,
      profileArn: this.credentials.profileArn,
    };
  }

  /**
   * 获取 refresh token
   */
  getRefreshToken(): string | null {
    return this.credentials?.refreshToken || null;
  }

  /**
   * 获取 profile ARN
   */
  getProfileArn(): string | null {
    return this.credentials?.profileArn || null;
  }

  /**
   * 更新 access token（刷新后调用）
   */
  updateAccessToken(accessToken: string): void {
    if (this.credentials) {
      this.credentials.accessToken = accessToken;
    }
  }

  /**
   * 注册认证状态变化监听器
   */
  onAuthStateChange(callback: (state: KiroAuthState) => void): () => void {
    this.authStateListeners.push(callback);
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知认证状态变化
   */
  private notifyAuthStateChange(): void {
    const state = this.getAuthState();
    for (const listener of this.authStateListeners) {
      try {
        listener(state);
      } catch (error) {
        logger.error('[KiroAuth] Error in auth state listener:', (error as Error).message);
      }
    }
  }

  /**
   * 重新加载凭证（用于手动刷新）
   */
  async reload(): Promise<boolean> {
    logger.info('[KiroAuth] Reloading credentials...');
    return this.loadCredentials();
  }

  /**
   * 获取 token 文件路径
   */
  getTokenFilePath(): string {
    return KIRO_AUTH_TOKEN_PATH;
  }
}
