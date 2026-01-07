/**
 * Electron 主进程入口
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import {
  createWidgetWindow,
  getWidgetWindow,
  showWidgetWindow,
  hideWidgetWindow,
  toggleWidgetWindow,
  isWidgetVisible,
  showSettingsWindow,
  closeSettingsWindow,
  getSettingsWindow
} from './window';
import { createTray, updateTrayMenu } from './tray';
import { GoogleAuthService, AuthState, LoginFlowState } from './auth';
import { QuotaService } from './quota';
import { QuotaSnapshot, AppSettings, ModelConfig, SelectedModel, AccountModelConfigs } from '../shared/types';
import { store } from './store';
import { logger } from './logger';

// 服务实例
const authService = GoogleAuthService.getInstance();
const quotaService = QuotaService.getInstance({ pollingInterval: 60_000 });

const authStateListenerAbortController = new AbortController();
app.on('before-quit', () => authStateListenerAbortController.abort());

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 第二个实例启动时，显示设置窗口
    showSettingsWindow();
  });

  app.whenReady().then(async () => {
    // 初始化认证服务
    await authService.initialize();

    // 创建悬浮窗（但不显示）
    await createWidgetWindow();

    // 创建托盘
    createTray();

    // 根据设置决定是否显示悬浮窗
    const settings = store.get('settings');
    if (settings.showWidget) {
      showWidgetWindow();
    }

    // 设置配额服务回调
    setupQuotaService();

    // 如果已认证，启动配额轮询
    if (authService.isAuthenticated()) {
      quotaService.startPolling();
    }

    // 监听认证状态变化
    authService.onAuthStateChange((state) => {
      if (state.state === AuthState.AUTHENTICATED) {
        quotaService.startPolling();
      } else if (state.state === AuthState.NOT_AUTHENTICATED) {
        quotaService.stopPolling();
      }
    }, { signal: authStateListenerAbortController.signal });

    // 监听登录流程状态变化，发送到设置窗口
    authService.onLoginFlowChange((info) => {
      const settingsWindow = getSettingsWindow();
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('login-flow-update', info);
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWidgetWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    // 不退出，保持托盘运行
    // macOS 和 Windows 都保持运行
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
  return authService.login();
});

// 取消登录
ipcMain.handle('google-login-cancel', () => {
  authService.cancelLogin();
});

// 获取登录流程状态
ipcMain.handle('get-login-flow-info', () => {
  return authService.getLoginFlowInfo();
});

// Google 登出
ipcMain.handle('google-logout', async (_event, accountId?: string) => {
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
