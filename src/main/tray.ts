/**
 * 系统托盘模块
 */
import { Tray, Menu, app, nativeImage, dialog } from 'electron';
import {
  showWidgetWindow,
  hideWidgetWindow,
  isWidgetVisible,
  showSettingsWindow
} from './window';
import { QuotaService } from './quota';
import { logger } from './logger';

let tray: Tray | null = null;

import path from 'path';

/**
 * 获取资源路径
 */
function getAssetPath(...paths: string[]): string {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(__dirname, '../../resources');

  return path.join(RESOURCES_PATH, ...paths);
}

/**
 * 获取托盘图标
 */
function getTrayIcon(): Electron.NativeImage {
  // Windows 推荐使用 ICO，但 nativeImage 也很好地支持 PNG
  // 为了最佳效果，我们使用专门生成的托盘 PNG
  const iconName = 'tray-32x32.png';
  const iconPath = getAssetPath(iconName);

  // 如果加载失败，回退到主图标
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    logger.warn(`Tray icon not found at ${iconPath}, trying icon.png`);
    return nativeImage.createFromPath(getAssetPath('icon.png'));
  }

  return icon;
}

/**
 * 创建系统托盘
 */
export function createTray(): Tray {
  const icon = getTrayIcon();

  tray = new Tray(icon);
  tray.setToolTip('AG Quota Watcher Desktop');

  // 创建托盘菜单
  updateTrayMenu();

  // 点击托盘图标切换悬浮窗
  tray.on('click', () => {
    if (isWidgetVisible()) {
      hideWidgetWindow();
    } else {
      showWidgetWindow();
    }
    updateTrayMenu();
  });

  return tray;
}

/**
 * 更新托盘菜单
 */
export function updateTrayMenu(): void {
  if (!tray) return;

  const widgetVisible = isWidgetVisible();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: widgetVisible ? '隐藏悬浮窗' : '显示悬浮窗',
      click: () => {
        if (widgetVisible) {
          hideWidgetWindow();
        } else {
          showWidgetWindow();
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: '立即刷新',
      click: async () => {
        try {
          const quotaService = QuotaService.getInstance();
          await quotaService.refreshNow();
        } catch (err) {
          logger.error('[Tray] Refresh failed:', err);
        }
      },
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        showSettingsWindow();
      },
    },
    {
      label: '关于',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: '关于 AG Quota Watcher Desktop',
          message: 'AG Quota Watcher Desktop',
          detail: `版本: ${app.getVersion()}\n\n监控 Google AI 模型配额的桌面应用`,
        });
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * 获取托盘实例
 */
export function getTray(): Tray | null {
  return tray;
}

/**
 * 销毁托盘
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
