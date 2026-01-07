/**
 * Google OAuth 2.0 认证服务
 * 管理 Google 账号登录、Token 刷新和认证状态
 */
import { shell } from 'electron';
import * as https from 'https';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_AUTH_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_SCOPES,
} from './constants';
import { TokenStorage, TokenData, AccountData } from './tokenStorage';
import { CallbackServer } from './callbackServer';
import { logger } from '../logger';

export enum AuthState {
  NOT_AUTHENTICATED = 'not_authenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  TOKEN_EXPIRED = 'token_expired',
  REFRESHING = 'refreshing',
  ERROR = 'error',
}

// 登录流程状态（用于 UI 显示）
export enum LoginFlowState {
  IDLE = 'idle',
  PREPARING = 'preparing',           // 准备中（启动回调服务器）
  OPENING_BROWSER = 'opening_browser', // 正在打开浏览器
  WAITING_AUTH = 'waiting_auth',     // 等待用户授权
  EXCHANGING_TOKEN = 'exchanging_token', // 交换 Token
  SUCCESS = 'success',               // 成功
  ERROR = 'error',                   // 失败
  CANCELLED = 'cancelled',           // 用户取消
}

export interface LoginFlowInfo {
  state: LoginFlowState;
  authUrl?: string;        // 授权 URL（用于手动复制）
  error?: string;          // 错误信息
}

export interface AuthStateInfo {
  state: AuthState;
  error?: string;
  activeAccount?: AccountData;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface UserInfoResponse {
  id: string;
  email: string;
  verified_email: boolean;
  name?: string;
  picture?: string;
}

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private tokenStorage: TokenStorage;
  private callbackServer: CallbackServer | null = null;
  private currentState: AuthState = AuthState.NOT_AUTHENTICATED;
  private lastError: string | undefined;
  private stateChangeListeners: Set<(state: AuthStateInfo) => void> = new Set();
  
  // 登录流程状态
  private loginFlowState: LoginFlowState = LoginFlowState.IDLE;
  private currentAuthUrl: string | undefined;
  private loginFlowListeners: Set<(info: LoginFlowInfo) => void> = new Set();
  private loginCancelled = false;

  private constructor() {
    this.tokenStorage = TokenStorage.getInstance();
  }

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    logger.log('[GoogleAuth] Initializing...');
    const hasAccount = this.tokenStorage.hasAnyAccount();

    if (hasAccount) {
      const activeId = this.tokenStorage.getActiveAccountId();
      if (activeId) {
        const isExpired = this.tokenStorage.isTokenExpired(activeId);
        if (isExpired) {
          try {
            await this.refreshToken(activeId);
          } catch (e) {
            logger.warn('[GoogleAuth] Token refresh failed during init:', e);
          }
        }
      }
      this.setState(AuthState.AUTHENTICATED);
    } else {
      this.setState(AuthState.NOT_AUTHENTICATED);
    }
  }

  isAuthenticated(): boolean {
    return this.currentState === AuthState.AUTHENTICATED;
  }

  getAuthState(): AuthStateInfo {
    return {
      state: this.currentState,
      error: this.lastError,
    };
  }

  /**
   * 发起 Google 登录流程
   */
  async login(): Promise<boolean> {
    logger.log('[GoogleAuth] Login initiated');

    if (this.currentState === AuthState.AUTHENTICATING) {
      logger.log('[GoogleAuth] Already authenticating, skipping');
      return false;
    }

    this.loginCancelled = false;

    try {
      this.setState(AuthState.AUTHENTICATING);
      this.setLoginFlowState(LoginFlowState.PREPARING);

      // 生成 PKCE 和 state
      const state = crypto.randomBytes(32).toString('hex');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      // 启动回调服务器
      this.callbackServer = new CallbackServer();
      await this.callbackServer.startServer();
      const redirectUri = this.callbackServer.getRedirectUri();
      logger.log('[GoogleAuth] Callback server started, redirect URI:', redirectUri);

      // 检查是否已取消
      if (this.loginCancelled) {
        throw new Error('Login cancelled by user');
      }

      // 构建授权 URL
      const authUrl = this.buildAuthUrl(redirectUri, state, codeChallenge);
      this.currentAuthUrl = authUrl;
      logger.log('[GoogleAuth] Auth URL built, opening browser...');

      // 开始等待回调
      const callbackPromise = this.callbackServer.waitForCallback(state);

      // 更新状态为打开浏览器
      this.setLoginFlowState(LoginFlowState.OPENING_BROWSER, authUrl);

      // 打开浏览器
      let browserOpened = false;
      try {
        await shell.openExternal(authUrl);
        browserOpened = true;
        logger.log('[GoogleAuth] Browser opened successfully');
      } catch (shellError) {
        logger.error('[GoogleAuth] shell.openExternal failed, trying fallback:', shellError);
        // Windows 备选方案
        if (process.platform === 'win32') {
          try {
            exec(`start "" "${authUrl}"`);
            browserOpened = true;
            logger.log('[GoogleAuth] Browser opened via exec fallback');
          } catch (execError) {
            logger.error('[GoogleAuth] exec fallback also failed:', execError);
          }
        }
      }

      // 无论浏览器是否打开成功，都进入等待授权状态（用户可以手动复制链接）
      this.setLoginFlowState(LoginFlowState.WAITING_AUTH, authUrl);
      if (!browserOpened) {
        logger.warn('[GoogleAuth] Browser failed to open, user can manually copy the URL');
      }

      // 检查是否已取消
      if (this.loginCancelled) {
        throw new Error('Login cancelled by user');
      }

      // 等待回调
      const result = await callbackPromise;
      
      // 检查是否已取消
      if (this.loginCancelled) {
        throw new Error('Login cancelled by user');
      }

      logger.log('[GoogleAuth] Received authorization code');
      this.setLoginFlowState(LoginFlowState.EXCHANGING_TOKEN, authUrl);

      // 交换 Token
      const tokenData = await this.exchangeCodeForToken(
        result.code,
        redirectUri,
        codeVerifier
      );

      // 获取用户信息
      const userInfo = await this.fetchUserInfo(tokenData.accessToken);

      // 保存账户和 Token
      const account: AccountData = {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      };

      this.tokenStorage.saveAccount(account);
      this.tokenStorage.saveToken(account.id, tokenData);
      this.tokenStorage.setActiveAccountId(account.id);

      this.setState(AuthState.AUTHENTICATED);
      this.setLoginFlowState(LoginFlowState.SUCCESS);
      logger.log('[GoogleAuth] Login successful:', userInfo.email);
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('[GoogleAuth] Login failed:', errorMessage);
      this.lastError = errorMessage;
      
      if (this.loginCancelled) {
        this.setLoginFlowState(LoginFlowState.CANCELLED);
        // 取消时恢复之前的认证状态
        const hasAccount = this.tokenStorage.hasAnyAccount();
        this.setState(hasAccount ? AuthState.AUTHENTICATED : AuthState.NOT_AUTHENTICATED);
      } else {
        this.setState(AuthState.ERROR);
        this.setLoginFlowState(LoginFlowState.ERROR, undefined, errorMessage);
      }
      return false;
    } finally {
      if (this.callbackServer) {
        this.callbackServer.stop();
        this.callbackServer = null;
      }
      this.currentAuthUrl = undefined;
    }
  }

  /**
   * 取消登录流程
   */
  cancelLogin(): void {
    logger.log('[GoogleAuth] Login cancelled by user');
    this.loginCancelled = true;
    
    if (this.callbackServer) {
      this.callbackServer.stop();
      this.callbackServer = null;
    }
    
    this.setLoginFlowState(LoginFlowState.CANCELLED);
    
    // 恢复之前的认证状态
    const hasAccount = this.tokenStorage.hasAnyAccount();
    this.setState(hasAccount ? AuthState.AUTHENTICATED : AuthState.NOT_AUTHENTICATED);
  }

  /**
   * 获取当前登录流程状态
   */
  getLoginFlowInfo(): LoginFlowInfo {
    return {
      state: this.loginFlowState,
      authUrl: this.currentAuthUrl,
      error: this.lastError,
    };
  }

  /**
   * 监听登录流程状态变化
   */
  onLoginFlowChange(callback: (info: LoginFlowInfo) => void): () => void {
    this.loginFlowListeners.add(callback);
    return () => {
      this.loginFlowListeners.delete(callback);
    };
  }

  /**
   * 设置登录流程状态并通知监听器
   */
  private setLoginFlowState(state: LoginFlowState, authUrl?: string, error?: string): void {
    this.loginFlowState = state;
    if (authUrl !== undefined) {
      this.currentAuthUrl = authUrl;
    }
    if (error !== undefined) {
      this.lastError = error;
    }
    
    const info = this.getLoginFlowInfo();
    this.loginFlowListeners.forEach((listener) => {
      try {
        listener(info);
      } catch (e) {
        logger.error('[GoogleAuth] Login flow listener error:', e);
      }
    });
  }

  /**
   * 登出指定账户
   */
  async logout(accountId?: string): Promise<void> {
    const targetId = accountId || this.tokenStorage.getActiveAccountId();
    if (targetId) {
      this.tokenStorage.deleteAccount(targetId);
    }

    const accounts = this.tokenStorage.getAccounts();
    if (accounts.length === 0) {
      this.setState(AuthState.NOT_AUTHENTICATED);
    }
  }

  /**
   * 获取有效的 Access Token
   */
  async getValidAccessToken(accountId?: string): Promise<string> {
    const targetId = accountId || this.tokenStorage.getActiveAccountId();
    if (!targetId) {
      throw new Error('No active account');
    }

    const token = this.tokenStorage.getToken(targetId);
    if (!token) {
      this.setState(AuthState.NOT_AUTHENTICATED);
      throw new Error('Not authenticated');
    }

    const isExpired = this.tokenStorage.isTokenExpired(targetId);
    if (isExpired) {
      await this.refreshToken(targetId);
    }

    const updatedToken = this.tokenStorage.getToken(targetId);
    if (!updatedToken) {
      throw new Error('Failed to get access token');
    }

    return updatedToken.accessToken;
  }

  /**
   * 获取所有账户
   */
  getAccounts(): AccountData[] {
    return this.tokenStorage.getAccounts();
  }

  /**
   * 获取活跃账户
   */
  getActiveAccount(): AccountData | null {
    const activeId = this.tokenStorage.getActiveAccountId();
    if (!activeId) return null;

    const accounts = this.tokenStorage.getAccounts();
    return accounts.find(a => a.id === activeId) || null;
  }

  /**
   * 切换活跃账户
   */
  setActiveAccount(accountId: string): void {
    this.tokenStorage.setActiveAccountId(accountId);
  }

  /**
   * 监听认证状态变化
   */
  onAuthStateChange(
    callback: (state: AuthStateInfo) => void,
    options?: { signal?: AbortSignal }
  ): () => void {
    this.stateChangeListeners.add(callback);

    const signal = options?.signal;
    if (signal?.aborted) {
      this.stateChangeListeners.delete(callback);
      return () => {};
    }

    const unsubscribe = () => {
      this.stateChangeListeners.delete(callback);
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };

    const abortHandler = () => {
      unsubscribe();
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    return unsubscribe;
  }

  /**
   * 刷新 Token
   */
  private async refreshToken(accountId: string): Promise<void> {
    logger.log('[GoogleAuth] Refreshing token for:', accountId);
    this.setState(AuthState.REFRESHING);

    try {
      const token = this.tokenStorage.getToken(accountId);
      if (!token?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await this.makeTokenRequest(params);

      this.tokenStorage.updateAccessToken(
        accountId,
        response.access_token,
        response.expires_in
      );

      this.setState(AuthState.AUTHENTICATED);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('[GoogleAuth] Token refresh failed:', errorMessage);
      this.lastError = errorMessage;
      this.setState(AuthState.TOKEN_EXPIRED);
      throw e;
    }
  }

  /**
   * 构建授权 URL
   */
  private buildAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * 交换 authorization code 获取 Token
   */
  private async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<TokenData> {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    const response = await this.makeTokenRequest(params);

    if (!response.refresh_token) {
      throw new Error('No refresh token in response');
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      tokenType: response.token_type,
      scope: response.scope,
    };
  }

  /**
   * 发送 Token 请求
   */
  private makeTokenRequest(params: URLSearchParams): Promise<TokenResponse> {
    return new Promise((resolve, reject) => {
      const postData = params.toString();
      const url = new URL(GOOGLE_TOKEN_ENDPOINT);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(new Error(`Token error: ${response.error} - ${response.error_description}`));
            } else {
              resolve(response as TokenResponse);
            }
          } catch (e) {
            reject(new Error(`Failed to parse token response: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * 获取用户信息
   */
  private fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: 'www.googleapis.com',
        port: 443,
        path: '/oauth2/v2/userinfo',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(JSON.parse(data) as UserInfoResponse);
            } else {
              reject(new Error(`Failed to fetch user info: ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse user info: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * 设置状态并通知监听器
   */
  private setState(state: AuthState): void {
    this.currentState = state;
    const stateInfo = this.getAuthState();
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(stateInfo);
      } catch (e) {
        logger.error('[GoogleAuth] Listener error:', e);
      }
    });
  }
}
