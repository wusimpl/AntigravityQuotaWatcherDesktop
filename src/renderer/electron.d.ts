/**
 * Electron API 类型声明
 * 定义 window.electronAPI 的类型
 */

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
  showResetTimeInWidget: boolean;
  language: 'auto' | 'zh-CN' | 'en';
}

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

export { };
