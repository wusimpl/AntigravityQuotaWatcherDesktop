/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import {
  createWidgetWindow,
  getWidgetWindow,
  showWidgetWindow,
  hideWidgetWindow,
  toggleWidgetWindow,
  isWidgetVisible,
  resizeWidgetWindowContentSize,
  showSettingsWindow,
  closeSettingsWindow,
  getSettingsWindow
} from './window';
import { createTray, updateTrayMenu } from './tray';
import { GoogleAuthService, AuthState } from './auth';
import { QuotaService } from './quota';
import { KiroAuthService, KiroQuotaService, KiroQuotaSnapshot } from './kiro';
import { QuotaSnapshot, AppSettings, ModelConfig, SelectedModel, AccountModelConfigs } from '../shared/types';
import { store } from './store';
import { logger } from './logger';
import { getSystemProxy } from './proxyUtils';
import { GoogleCloudCodeClient } from '../shared/api';

// Initialize logger first
logger.initialize();
logger.info('[Main] Application starting, version:', app.getVersion());

// 服务实例
const authService = GoogleAuthService.getInstance();
const quotaService = QuotaService.getInstance({ pollingInterval: 60_000 });
const apiClient = GoogleCloudCodeClient.getInstance();

// Kiro 服务实例
const kiroAuthService = KiroAuthService.getInstance();
const kiroQuotaService = KiroQuotaService.getInstance(60_000);

const authStateListenerAbortController = new AbortController();
app.on('before-quit', () => authStateListenerAbortController.abort());

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  logger.info('[Main] Another instance is running, quitting');
  app.quit();
} else {
  app.on('second-instance', () => {
    logger.info('[Main] Second instance detected, showing settings window');
    // 第二个实例启动时，显示设置窗口
    showSettingsWindow();
  });

  app.whenReady().then(async () => {
    logger.info('[Main] App ready, initializing services');

    // 初始化认证服务
    await authService.initialize();
    logger.info('[Main] Auth service initialized');

    // 初始化 Kiro 认证服务
    await kiroAuthService.initialize();
    logger.info('[Main] Kiro auth service initialized');

    // 应用代理设置
    await applyProxySettings();

    // 创建悬浮窗（但不显示）
    await createWidgetWindow();
    logger.info('[Main] Widget window created');

    // 创建托盘
    createTray();
    logger.info('[Main] Tray created');

    // 根据设置决定是否显示悬浮窗
    const settings = store.get('settings');
    if (settings.showWidget) {
      showWidgetWindow();
      logger.info('[Main] Widget window shown');
    }

    // 设置配额服务回调
    setupQuotaService();

    // 设置 Kiro 配额服务回调
    setupKiroQuotaService();

    // 如果已认证，启动配额轮询
    if (authService.isAuthenticated()) {
      quotaService.startPolling();
      logger.info('[Main] Quota polling started');
    }

    // 如果 Kiro 已认证，启动 Kiro 配额轮询
    if (kiroAuthService.isAuthenticated()) {
      kiroQuotaService.startPolling();
      logger.info('[Main] Kiro quota polling started');
    }

    // 监听认证状态变化
    authService.onAuthStateChange((state) => {
      logger.info('[Main] Auth state changed:', state.state);
      if (state.state === AuthState.AUTHENTICATED) {
        quotaService.startPolling();
      } else if (state.state === AuthState.NOT_AUTHENTICATED) {
        quotaService.stopPolling();
      }
    }, { signal: authStateListenerAbortController.signal });

    // 监听登录流程状态变化，发送到设置窗口
    authService.onLoginFlowChange((info) => {
      logger.info('[Main] Login flow state:', info.state);
      const settingsWindow = getSettingsWindow();
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('login-flow-update', info);
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        logger.info('[Main] App activated, creating widget window');
        createWidgetWindow();
      }
    });
    
    logger.info('[Main] Application initialization complete');
  });

  app.on('window-all-closed', () => {
    // 不退出，保持托盘运行
    // macOS 和 Windows 都保持运行
    logger.info('[Main] All windows closed, keeping tray running');
  });
}

// ========== IPC 处理器 ==========

// 窗口控制 - 悬浮窗
ipcMain.on('widget-close', () => {
  hideWidgetWindow();
  updateTrayMenu();
});

// 窗口控制 - 设置窗口
ipcMain.on('settings-close', () => {
  closeSettingsWindow();
});

ipcMain.on('settings-minimize', () => {
  const settingsWindow = getSettingsWindow();
  settingsWindow?.minimize();
});

// 兼容旧的窗口控制
ipcMain.on('window-close', () => {
  hideWidgetWindow();
  updateTrayMenu();
});

ipcMain.on('window-minimize', () => {
  const settingsWindow = getSettingsWindow();
  settingsWindow?.minimize();
});

// 悬浮窗控制
ipcMain.handle('toggle-widget', () => {
  toggleWidgetWindow();
  updateTrayMenu();
  return isWidgetVisible();
});

ipcMain.handle('show-widget', () => {
  showWidgetWindow();
  updateTrayMenu();
});

ipcMain.handle('hide-widget', () => {
  hideWidgetWindow();
  updateTrayMenu();
});

ipcMain.handle('is-widget-visible', () => {
  return isWidgetVisible();
});

ipcMain.handle('widget-set-size', (event, size: { width: number; height: number }) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  const widgetWindow = getWidgetWindow();
  if (!senderWindow || !widgetWindow || senderWindow.id !== widgetWindow.id) return;
  resizeWidgetWindowContentSize(size.width, size.height);
});

// 打开设置窗口
ipcMain.handle('open-settings', () => {
  showSettingsWindow();
});

// 应用信息
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Google 登录
ipcMain.handle('google-login', async () => {
  logger.info('[IPC] Google login requested');
  return authService.login();
});

// 取消登录
ipcMain.handle('google-login-cancel', () => {
  logger.info('[IPC] Google login cancelled');
  authService.cancelLogin();
});

// 获取登录流程状态
ipcMain.handle('get-login-flow-info', () => {
  return authService.getLoginFlowInfo();
});

// Google 登出
ipcMain.handle('google-logout', async (_event, accountId?: string) => {
  logger.info('[IPC] Google logout requested, accountId:', accountId || 'active');
  return authService.logout(accountId);
});

// 获取所有账户
ipcMain.handle('get-accounts', async () => {
  return authService.getAccounts();
});

// 获取活跃账户
ipcMain.handle('get-active-account', async () => {
  return authService.getActiveAccount();
});

// 切换活跃账户
ipcMain.handle('set-active-account', async (_event, accountId: string) => {
  logger.info('[IPC] Set active account:', accountId);
  authService.setActiveAccount(accountId);
});

// 获取认证状态
ipcMain.handle('get-auth-state', () => {
  return authService.getAuthState();
});

// 获取有效的 Access Token
ipcMain.handle('get-access-token', async (_event, accountId?: string) => {
  return authService.getValidAccessToken(accountId);
});

// ========== 日志导出 IPC 处理器 ==========

ipcMain.handle('export-logs', async () => {
  logger.info('[IPC] Export logs requested');
  
  const settingsWindow = getSettingsWindow();
  const result = await dialog.showSaveDialog(settingsWindow || BrowserWindow.getFocusedWindow()!, {
    title: 'Export Logs',
    defaultPath: `float-logs-${new Date().toISOString().split('T')[0]}.txt`,
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'Log Files', extensions: ['log'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) {
    logger.info('[IPC] Export logs cancelled by user');
    return { success: false, cancelled: true };
  }

  const success = logger.exportLogs(result.filePath);
  return { success, filePath: result.filePath };
});

ipcMain.handle('get-log-path', () => {
  return logger.getLogDir();
});

// ========== 配额相关 IPC 处理器 ==========

ipcMain.handle('get-quota', async () => {
  return quotaService.getActiveAccountQuota();
});

ipcMain.handle('get-account-quota', async (_event, accountId: string) => {
  return quotaService.getCachedQuota(accountId);
});

ipcMain.handle('get-all-quotas', async () => {
  const quotas = quotaService.getAllCachedQuotas();
  return Object.fromEntries(quotas);
});

ipcMain.handle('refresh-quota', async () => {
  await quotaService.refreshNow();
  return quotaService.getActiveAccountQuota();
});

ipcMain.handle('set-polling-interval', async (_event, intervalMs: number) => {
  quotaService.setPollingInterval(intervalMs);
});

ipcMain.handle('start-polling', async () => {
  await quotaService.startPolling();
});

ipcMain.handle('stop-polling', async () => {
  quotaService.stopPolling();
});

ipcMain.handle('get-available-models', async () => {
  const snapshot = await quotaService.getActiveAccountQuota();
  if (!snapshot?.models) return [];
  return snapshot.models.map((m: { modelId: string; displayName: string }) => ({
    modelId: m.modelId,
    displayName: m.displayName,
  }));
});

// ========== 设置相关 IPC 处理器 ==========

ipcMain.handle('get-settings', () => {
  return {
    settings: store.get('settings'),
    modelConfigs: store.get('modelConfigs'),
    accountModelConfigs: store.get('accountModelConfigs'),
    selectedModels: store.get('selectedModels'),
  };
});

ipcMain.handle('save-settings', async (_event, data: {
  settings: AppSettings;
  modelConfigs: Record<string, ModelConfig>;
  accountModelConfigs?: AccountModelConfigs;
  selectedModels?: SelectedModel[];
}) => {
  logger.info('[IPC] Saving settings');
  const { settings, modelConfigs, accountModelConfigs, selectedModels } = data;
  const prevSettings = store.get('settings') as AppSettings;

  // 保存设置
  store.set('settings', settings);
  store.set('modelConfigs', modelConfigs);
  if (accountModelConfigs !== undefined) {
    store.set('accountModelConfigs', accountModelConfigs);
  }
  if (selectedModels !== undefined) {
    store.set('selectedModels', selectedModels);
  }

  // 应用轮询间隔（仅在变化时更新，避免无关设置触发轮询重启 + 立即拉取）
  const prevPollingInterval = prevSettings?.pollingInterval ?? settings.pollingInterval;
  if (prevPollingInterval !== settings.pollingInterval) {
    quotaService.setPollingInterval(settings.pollingInterval * 1000);
  }

  // 应用开机自启设置
  app.setLoginItemSettings({
    openAtLogin: settings.autoStart,
    openAsHidden: true,
  });

  // 应用悬浮窗显示设置
  if ((prevSettings?.showWidget ?? false) !== settings.showWidget) {
    if (settings.showWidget) {
      showWidgetWindow();
    } else {
      hideWidgetWindow();
    }
  }
  updateTrayMenu();

  // 应用代理设置（如果代理启用状态或代理 URL 变化）
  const prevProxyEnabled = prevSettings?.proxyEnabled ?? false;
  const prevProxyUrl = prevSettings?.proxyUrl ?? '';
  if (prevProxyEnabled !== (settings.proxyEnabled ?? false) || prevProxyUrl !== (settings.proxyUrl ?? '')) {
    await applyProxySettings();
    // 代理设置变更后自动刷新模型列表，避免用户需要重启或等待下一次轮询
    if (authService.isAuthenticated()) {
      logger.info('[Main] Proxy settings changed, refreshing quota...');
      quotaService.refreshNow().catch(err => {
        logger.error('[Main] Failed to refresh quota after proxy change:', err);
      });
    }
  }

  // 广播设置更新
  const widgetWindow = getWidgetWindow();
  const settingsWindow = getSettingsWindow();
  const updateData = {
    settings,
    modelConfigs,
    accountModelConfigs: store.get('accountModelConfigs'),
    selectedModels: store.get('selectedModels'),
  };
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('settings-update', updateData);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settings-update', updateData);
  }
});

ipcMain.handle('get-model-configs', () => {
  return store.get('modelConfigs');
});

ipcMain.handle('save-model-configs', async (_event, configs: Record<string, ModelConfig>) => {
  store.set('modelConfigs', configs);

  // 广播设置更新
  const settings = store.get('settings');
  const widgetWindow = getWidgetWindow();
  const settingsWindow = getSettingsWindow();

  const updateData = {
    settings,
    modelConfigs: configs,
    accountModelConfigs: store.get('accountModelConfigs'),
    selectedModels: store.get('selectedModels'),
  };
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('settings-update', updateData);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settings-update', updateData);
  }
});

ipcMain.handle('get-selected-models', () => {
  return store.get('selectedModels');
});

ipcMain.handle('save-selected-models', async (_event, selectedModels: SelectedModel[]) => {
  store.set('selectedModels', selectedModels);

  // 广播设置更新
  const settings = store.get('settings');
  const widgetWindow = getWidgetWindow();
  const settingsWindow = getSettingsWindow();

  const updateData = {
    settings,
    modelConfigs: store.get('modelConfigs'),
    accountModelConfigs: store.get('accountModelConfigs'),
    selectedModels,
  };
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('settings-update', updateData);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('settings-update', updateData);
  }
});

ipcMain.handle('set-auto-start', async (_event, enabled: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
  });
  const settings = store.get('settings');
  store.set('settings', { ...settings, autoStart: enabled });
});

// ========== 配额服务设置 ==========

function setupQuotaService(): void {
  // 配额更新回调 - 发送到所有窗口
  quotaService.onQuotaUpdate((accountId: string, snapshot: QuotaSnapshot) => {
    const widgetWindow = getWidgetWindow();
    const settingsWindow = getSettingsWindow();

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('quota-update', { accountId, snapshot });
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('quota-update', { accountId, snapshot });
    }
  });

  // 错误回调
  quotaService.onError((accountId: string, error: Error) => {
    logger.error(`[Main] Quota error for ${accountId}:`, error.message);
    const widgetWindow = getWidgetWindow();
    const settingsWindow = getSettingsWindow();

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('quota-error', { accountId, error: error.message });
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('quota-error', { accountId, error: error.message });
    }
  });

  // 状态回调
  quotaService.onStatus((status, retryCount) => {
    const widgetWindow = getWidgetWindow();
    const settingsWindow = getSettingsWindow();

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('quota-status', { status, retryCount });
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('quota-status', { status, retryCount });
    }
  });
}

// ========== 代理设置 ==========

/**
 * 应用代理设置到 API 客户端
 * 只有当 proxyEnabled 为 true 时才使用代理
 * 如果用户设置了代理 URL 则使用用户设置，否则尝试获取系统代理
 */
async function applyProxySettings(): Promise<void> {
  const settings = store.get('settings');
  
  // 如果代理未启用，直接设置为 null
  if (!settings.proxyEnabled) {
    logger.info('[Main] Proxy disabled');
    apiClient.setProxyUrl(null);
    return;
  }

  const userProxyUrl = settings.proxyUrl;
  let effectiveProxyUrl: string | null = null;

  if (userProxyUrl && userProxyUrl.trim()) {
    // 用户明确设置了代理
    effectiveProxyUrl = userProxyUrl.trim();
    logger.info('[Main] Using user-configured proxy:', effectiveProxyUrl);
  } else {
    // 尝试获取系统代理
    effectiveProxyUrl = await getSystemProxy('https://cloudcode-pa.googleapis.com');
    if (effectiveProxyUrl) {
      logger.info('[Main] Using system proxy:', effectiveProxyUrl);
    } else {
      logger.info('[Main] No proxy configured');
    }
  }

  apiClient.setProxyUrl(effectiveProxyUrl);
  // 同时设置 Kiro API 客户端的代理
  kiroQuotaService.setProxyUrl(effectiveProxyUrl);
}

// ========== 代理相关 IPC 处理器 ==========

ipcMain.handle('get-system-proxy', async () => {
  return getSystemProxy('https://cloudcode-pa.googleapis.com');
});

// ========== Kiro 相关 IPC 处理器 ==========

ipcMain.handle('get-kiro-auth-state', () => {
  return kiroAuthService.getAuthState();
});

ipcMain.handle('get-kiro-quota', () => {
  return kiroQuotaService.getCachedQuota();
});

ipcMain.handle('refresh-kiro-quota', async () => {
  await kiroQuotaService.refreshNow();
  return kiroQuotaService.getCachedQuota();
});

ipcMain.handle('reload-kiro-auth', async () => {
  const result = await kiroAuthService.reload();
  if (result && kiroAuthService.isAuthenticated()) {
    kiroQuotaService.startPolling();
  }
  return result;
});

// ========== Kiro 配额服务设置 ==========

function setupKiroQuotaService(): void {
  // 配额更新回调 - 发送到所有窗口
  kiroQuotaService.onQuotaUpdate((snapshot: KiroQuotaSnapshot) => {
    const widgetWindow = getWidgetWindow();
    const settingsWindow = getSettingsWindow();

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('kiro-quota-update', snapshot);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('kiro-quota-update', snapshot);
    }
  });

  // 错误回调
  kiroQuotaService.onError((error: Error) => {
    logger.error('[Main] Kiro quota error:', error.message);
    const widgetWindow = getWidgetWindow();
    const settingsWindow = getSettingsWindow();

    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('kiro-quota-error', error.message);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('kiro-quota-error', error.message);
    }
  });
}
