/**
 * Preload 脚本
 * 在渲染进程中暴露安全的 API
 */
import { contextBridge, ipcRenderer } from 'electron';

// 账户信息类型
interface AccountInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

// 认证状态类型
interface AuthStateInfo {
  state: string;
  error?: string;
  activeAccount?: AccountInfo;
}

// 登录流程状态类型
interface LoginFlowInfo {
  state: 'idle' | 'preparing' | 'opening_browser' | 'waiting_auth' | 'exchanging_token' | 'success' | 'error' | 'cancelled';
  authUrl?: string;
  error?: string;
}

// 配额快照类型
interface QuotaSnapshot {
  timestamp: string;
  models: Array<{
    modelId: string;
    displayName: string;
    alias?: string;
    remainingFraction: number;
    remainingPercentage: number;
    isExhausted: boolean;
    resetTime: string;
  }>;
  userEmail?: string;
  tier?: string;
}

// 模型信息类型
interface ModelInfo {
  modelId: string;
  displayName: string;
}

// 模型配置类型
interface ModelConfig {
  visible: boolean;
  alias: string;
  order: number;
}

// 选中的模型类型
interface SelectedModel {
  accountId: string;
  modelId: string;
}

// 账户模型配置类型
type AccountModelConfigs = Record<string, Record<string, ModelConfig>>;

// 应用设置类型
interface AppSettings {
  pollingInterval: number;
  warningThreshold: number;
  criticalThreshold: number;
  autoStart: boolean;
  notifications: boolean;
  showWidget: boolean;
  widgetScale: number;
  language: 'auto' | 'zh-CN' | 'en';
}

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 窗口控制 - 悬浮窗
  widgetClose: () => ipcRenderer.send('widget-close'),

  // 窗口控制 - 设置窗口
  settingsClose: () => ipcRenderer.send('settings-close'),
  settingsMinimize: () => ipcRenderer.send('settings-minimize'),

  // 兼容旧的窗口控制
  minimizeWindow: () => ipcRenderer.send('settings-minimize'),
  closeWindow: () => ipcRenderer.send('settings-close'),

  // 悬浮窗控制
  toggleWidget: () => ipcRenderer.invoke('toggle-widget'),
  showWidget: () => ipcRenderer.invoke('show-widget'),
  hideWidget: () => ipcRenderer.invoke('hide-widget'),
  isWidgetVisible: () => ipcRenderer.invoke('is-widget-visible'),

  // 打开设置
  openSettings: () => ipcRenderer.invoke('open-settings'),

  // 配额相关
  getQuota: () => ipcRenderer.invoke('get-quota'),
  getAccountQuota: (accountId: string) => ipcRenderer.invoke('get-account-quota', accountId),
  getAllQuotas: () => ipcRenderer.invoke('get-all-quotas'),
  refreshQuota: () => ipcRenderer.invoke('refresh-quota'),
  setPollingInterval: (intervalMs: number) => ipcRenderer.invoke('set-polling-interval', intervalMs),
  startPolling: () => ipcRenderer.invoke('start-polling'),
  stopPolling: () => ipcRenderer.invoke('stop-polling'),
  getAvailableModels: () => ipcRenderer.invoke('get-available-models'),

  // 配额事件监听
  onQuotaUpdate: (callback: (data: { accountId: string; snapshot: QuotaSnapshot }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { accountId: string; snapshot: QuotaSnapshot }) => callback(data);
    ipcRenderer.on('quota-update', handler);
    // 返回取消订阅函数
    return () => ipcRenderer.removeListener('quota-update', handler);
  },
  onQuotaError: (callback: (data: { accountId: string; error: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { accountId: string; error: string }) => callback(data);
    ipcRenderer.on('quota-error', handler);
    return () => ipcRenderer.removeListener('quota-error', handler);
  },
  onQuotaStatus: (callback: (data: { status: string; retryCount?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { status: string; retryCount?: number }) => callback(data);
    ipcRenderer.on('quota-status', handler);
    return () => ipcRenderer.removeListener('quota-status', handler);
  },

  // 设置更新监听
  onSettingsUpdate: (callback: (data: {
    settings: AppSettings;
    modelConfigs: Record<string, ModelConfig>;
    accountModelConfigs: AccountModelConfigs;
    selectedModels: SelectedModel[];
  }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: {
      settings: AppSettings;
      modelConfigs: Record<string, ModelConfig>;
      accountModelConfigs: AccountModelConfigs;
      selectedModels: SelectedModel[];
    }) => callback(data);
    ipcRenderer.on('settings-update', handler);
    return () => ipcRenderer.removeListener('settings-update', handler);
  },

  // 设置相关
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: {
    settings: AppSettings;
    modelConfigs: Record<string, ModelConfig>;
    accountModelConfigs?: AccountModelConfigs;
    selectedModels?: SelectedModel[];
  }) => ipcRenderer.invoke('save-settings', settings),
  getModelConfigs: () => ipcRenderer.invoke('get-model-configs'),
  saveModelConfigs: (configs: Record<string, ModelConfig>) => ipcRenderer.invoke('save-model-configs', configs),
  getSelectedModels: () => ipcRenderer.invoke('get-selected-models'),
  saveSelectedModels: (selectedModels: SelectedModel[]) => ipcRenderer.invoke('save-selected-models', selectedModels),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),

  // 认证相关
  login: () => ipcRenderer.invoke('google-login'),
  loginCancel: () => ipcRenderer.invoke('google-login-cancel'),
  getLoginFlowInfo: () => ipcRenderer.invoke('get-login-flow-info'),
  onLoginFlowUpdate: (callback: (info: LoginFlowInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: LoginFlowInfo) => callback(info);
    ipcRenderer.on('login-flow-update', handler);
    return () => ipcRenderer.removeListener('login-flow-update', handler);
  },
  logout: (accountId?: string) => ipcRenderer.invoke('google-logout', accountId),
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  getActiveAccount: () => ipcRenderer.invoke('get-active-account'),
  setActiveAccount: (accountId: string) => ipcRenderer.invoke('set-active-account', accountId),
  getAuthState: () => ipcRenderer.invoke('get-auth-state'),
});

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      // 应用信息
      getAppVersion: () => Promise<string>;

      // 窗口控制
      widgetClose: () => void;
      settingsClose: () => void;
      settingsMinimize: () => void;
      minimizeWindow: () => void;
      closeWindow: () => void;

      // 悬浮窗控制
      toggleWidget: () => Promise<boolean>;
      showWidget: () => Promise<void>;
      hideWidget: () => Promise<void>;
      isWidgetVisible: () => Promise<boolean>;

      // 打开设置
      openSettings: () => Promise<void>;

      // 配额相关
      getQuota: () => Promise<QuotaSnapshot | null>;
      getAccountQuota: (accountId: string) => Promise<QuotaSnapshot | undefined>;
      getAllQuotas: () => Promise<Record<string, QuotaSnapshot>>;
      refreshQuota: () => Promise<QuotaSnapshot | null>;
      setPollingInterval: (intervalMs: number) => Promise<void>;
      startPolling: () => Promise<void>;
      stopPolling: () => Promise<void>;
      getAvailableModels: () => Promise<ModelInfo[]>;
      onQuotaUpdate: (callback: (data: { accountId: string; snapshot: QuotaSnapshot }) => void) => () => void;
      onQuotaError: (callback: (data: { accountId: string; error: string }) => void) => () => void;
      onQuotaStatus: (callback: (data: { status: string; retryCount?: number }) => void) => () => void;
      onSettingsUpdate: (callback: (data: {
        settings: AppSettings;
        modelConfigs: Record<string, ModelConfig>;
        accountModelConfigs: AccountModelConfigs;
        selectedModels: SelectedModel[];
      }) => void) => () => void;

      // 设置相关
      getSettings: () => Promise<{
        settings: AppSettings;
        modelConfigs: Record<string, ModelConfig>;
        accountModelConfigs: AccountModelConfigs;
        selectedModels: SelectedModel[];
      }>;
      saveSettings: (settings: {
        settings: AppSettings;
        modelConfigs: Record<string, ModelConfig>;
        accountModelConfigs?: AccountModelConfigs;
        selectedModels?: SelectedModel[];
      }) => Promise<void>;
      getModelConfigs: () => Promise<Record<string, ModelConfig>>;
      saveModelConfigs: (configs: Record<string, ModelConfig>) => Promise<void>;
      getSelectedModels: () => Promise<SelectedModel[]>;
      saveSelectedModels: (selectedModels: SelectedModel[]) => Promise<void>;
      setAutoStart: (enabled: boolean) => Promise<void>;

      // 认证相关
      login: () => Promise<boolean>;
      loginCancel: () => Promise<void>;
      getLoginFlowInfo: () => Promise<LoginFlowInfo>;
      onLoginFlowUpdate: (callback: (info: LoginFlowInfo) => void) => () => void;
      logout: (accountId?: string) => Promise<void>;
      getAccounts: () => Promise<AccountInfo[]>;
      getActiveAccount: () => Promise<AccountInfo | null>;
      setActiveAccount: (accountId: string) => Promise<void>;
      getAuthState: () => Promise<AuthStateInfo>;
    };
  }
}
