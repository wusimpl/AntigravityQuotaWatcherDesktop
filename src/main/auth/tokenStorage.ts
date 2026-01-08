/**
 * Token 安全存储服务
 * 使用 electron-store 加密存储 OAuth Token
 */
import Store from 'electron-store';
import { safeStorage } from 'electron';
import { TOKEN_STORAGE_KEY, ACCOUNTS_STORAGE_KEY } from './constants';
import { logger } from '../logger';

const DEFAULT_TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * OAuth Token 数据结构
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;  // Unix timestamp (毫秒)
  tokenType: string;
  scope: string;
}

/**
 * 账户信息
 */
export interface AccountData {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * 存储结构
 */
interface TokenStoreSchema {
  [TOKEN_STORAGE_KEY]: Record<string, string>;  // accountId -> encrypted token
  [ACCOUNTS_STORAGE_KEY]: AccountData[];
  activeAccountId?: string;
}

/**
 * Token 存储服务
 */
export class TokenStorage {
  private static instance: TokenStorage;
  private store: Store<TokenStoreSchema>;

  private constructor() {
    this.store = new Store<TokenStoreSchema>({
      name: 'auth',
      defaults: {
        [TOKEN_STORAGE_KEY]: {},
        [ACCOUNTS_STORAGE_KEY]: [],
      },
    });
  }

  static getInstance(): TokenStorage {
    if (!TokenStorage.instance) {
      TokenStorage.instance = new TokenStorage();
    }
    return TokenStorage.instance;
  }

  /**
   * 加密数据
   */
  private encrypt(data: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = safeStorage.encryptString(data);
      return buffer.toString('base64');
    }
    // 如果加密不可用，使用 base64 编码（不安全，仅作为后备）
    return Buffer.from(data).toString('base64');
  }

  /**
   * 解密数据
   */
  private decrypt(encrypted: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(encrypted, 'base64');
      return safeStorage.decryptString(buffer);
    }
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }

  /**
   * 保存 Token
   */
  saveToken(accountId: string, token: TokenData): void {
    logger.log('[TokenStorage] Saving token for account:', accountId);
    const tokens = this.store.get(TOKEN_STORAGE_KEY, {});
    const encrypted = this.encrypt(JSON.stringify(token));
    tokens[accountId] = encrypted;
    this.store.set(TOKEN_STORAGE_KEY, tokens);
  }

  /**
   * 获取 Token
   */
  getToken(accountId: string): TokenData | null {
    const tokens = this.store.get(TOKEN_STORAGE_KEY, {});
    const encrypted = tokens[accountId];
    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted) as TokenData;
    } catch (e) {
      logger.error('[TokenStorage] Failed to decrypt token:', e);
      return null;
    }
  }

  /**
   * 删除 Token
   */
  deleteToken(accountId: string): void {
    logger.log('[TokenStorage] Deleting token for account:', accountId);
    const tokens = this.store.get(TOKEN_STORAGE_KEY, {});
    delete tokens[accountId];
    this.store.set(TOKEN_STORAGE_KEY, tokens);
  }

  /**
   * 检查 Token 是否过期
   * @param bufferMs 提前刷新的缓冲时间，默认 5 分钟
   */
  isTokenExpired(accountId: string, bufferMs: number = DEFAULT_TOKEN_EXPIRY_BUFFER_MS): boolean {
    const token = this.getToken(accountId);
    if (!token) return true;
    return Date.now() + bufferMs >= token.expiresAt;
  }

  /**
   * 更新 Access Token
   */
  updateAccessToken(accountId: string, accessToken: string, expiresIn: number): void {
    const token = this.getToken(accountId);
    if (!token) throw new Error('No existing token to update');

    token.accessToken = accessToken;
    token.expiresAt = Date.now() + expiresIn * 1000;
    this.saveToken(accountId, token);
  }

  // ========== 账户管理 ==========

  /**
   * 保存账户信息
   */
  saveAccount(account: AccountData): void {
    logger.log('[TokenStorage] Saving account:', account.email);
    const accounts = this.store.get(ACCOUNTS_STORAGE_KEY, []);
    const index = accounts.findIndex(a => a.id === account.id);
    if (index >= 0) {
      accounts[index] = account;
    } else {
      accounts.push(account);
    }
    this.store.set(ACCOUNTS_STORAGE_KEY, accounts);
  }

  /**
   * 获取所有账户
   */
  getAccounts(): AccountData[] {
    return this.store.get(ACCOUNTS_STORAGE_KEY, []);
  }

  /**
   * 删除账户
   */
  deleteAccount(accountId: string): void {
    logger.log('[TokenStorage] Deleting account:', accountId);
    const accounts = this.store.get(ACCOUNTS_STORAGE_KEY, []);
    const filtered = accounts.filter(a => a.id !== accountId);
    this.store.set(ACCOUNTS_STORAGE_KEY, filtered);
    this.deleteToken(accountId);

    // 如果删除的是当前活跃账户，切换到第一个
    if (this.getActiveAccountId() === accountId) {
      logger.log('[TokenStorage] Deleted active account, switching to first available');
      this.setActiveAccountId(filtered[0]?.id);
    }
  }

  /**
   * 设置活跃账户
   */
  setActiveAccountId(accountId: string | undefined): void {
    this.store.set('activeAccountId', accountId);
  }

  /**
   * 获取活跃账户 ID
   */
  getActiveAccountId(): string | undefined {
    return this.store.get('activeAccountId');
  }

  /**
   * 检查是否有任何账户
   */
  hasAnyAccount(): boolean {
    const accounts = this.getAccounts();
    return accounts.length > 0;
  }
}
