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
import { getTrayTranslations, formatMessage } from './i18n';

let tray: Tray | null = null;

import fs from 'fs';
import path from 'path';

/**
 * 获取资源路径
 */
function getAssetPath(...paths: string[]): string {
  // 打包后：优先使用 extraResources 复制出来的目录（process.resourcesPath/resources）
  // 否则回退到 app.asar 内部的 resources（app.getAppPath()/resources）
  const unpackedResourcesPath = path.join(process.resourcesPath, 'resources');
  const resourcesBasePath =
    app.isPackaged && fs.existsSync(unpackedResourcesPath)
      ? unpackedResourcesPath
      : path.join(app.getAppPath(), 'resources');

  return path.join(resourcesBasePath, ...paths);
}

/**
 * 获取托盘图标
 */
function getTrayIcon(): Electron.NativeImage {
  // macOS 托盘图标推荐 16x16（系统会自动处理 Retina 显示）
  // Windows 托盘图标推荐 32x32
  const iconName = process.platform === 'darwin' ? 'tray-16x16.png' : 'tray-32x32.png';
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
  tray.setToolTip('Float');

  // 创建托盘菜单
  updateTrayMenu();

  // 左键点击托盘图标也弹出菜单（与右键一致）
  tray.on('click', () => {
    tray?.popUpContextMenu();
  });

  return tray;
}

/**
 * 更新托盘菜单
 */
export function updateTrayMenu(): void {
  if (!tray) return;

  const widgetVisible = isWidgetVisible();
  const t = getTrayTranslations();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: widgetVisible ? t.hideWidget : t.showWidget,
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
      label: t.refreshNow,
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
      label: t.settings,
      click: () => {
        showSettingsWindow();
      },
    },
    {
      label: t.about,
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: t.aboutTitle,
          message: t.aboutMessage,
          detail: formatMessage(t.aboutDetail, { version: app.getVersion() }),
        });
      },
    },
    { type: 'separator' },
    {
      label: t.exit,
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
