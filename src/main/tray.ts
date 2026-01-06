/**
 * 系统托盘模块
 */
import { Tray, Menu, app, nativeImage } from 'electron';
import { 
  showWidgetWindow, 
  hideWidgetWindow, 
  isWidgetVisible,
  showSettingsWindow 
} from './window';
import { QuotaService } from './quota';
import { store } from './store';

let tray: Tray | null = null;

/**
 * 创建一个简单的托盘图标（16x16 蓝色圆形）
 */
function createTrayIcon(): Electron.NativeImage {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 6;
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      if (dist <= radius) {
        buffer[idx] = 59;     // R
        buffer[idx + 1] = 130; // G
        buffer[idx + 2] = 246; // B
        buffer[idx + 3] = 255; // A
      } else {
        buffer[idx] = 0;
        buffer[idx + 1] = 0;
        buffer[idx + 2] = 0;
        buffer[idx + 3] = 0;
      }
    }
  }
  
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/**
 * 创建系统托盘
 */
export function createTray(): Tray {
  const icon = createTrayIcon();
  
  tray = new Tray(icon);
  tray.setToolTip('AG Quota Desktop');

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
          console.error('[Tray] Refresh failed:', err);
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
        const { dialog } = require('electron');
        dialog.showMessageBox({
          type: 'info',
          title: '关于 AG Quota Desktop',
          message: 'AG Quota Desktop',
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
