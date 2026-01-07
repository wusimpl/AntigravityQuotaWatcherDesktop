/**
 * 窗口管理模块
 * 管理悬浮窗（widget）和设置窗口
 */
import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import { store } from './store';

let widgetWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let forceQuit = false;

// 监听 app 退出前事件，设置强制退出标志
app.on('before-quit', () => {
  forceQuit = true;
});

/**
 * 创建悬浮窗（小组件风格，无边框无按钮）
 */
export async function createWidgetWindow(): Promise<BrowserWindow> {
  // 获取保存的窗口位置
  const savedBounds = store.get('widgetBounds') as { x: number; y: number; width: number; height: number } | undefined;
  
  // 默认窗口大小（紧凑的小组件）
  const defaultWidth = 280;
  const defaultHeight = 180;

  // 计算初始位置（右下角）
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const defaultX = screenWidth - defaultWidth - 20;
  const defaultY = screenHeight - defaultHeight - 20;

  widgetWindow = new BrowserWindow({
    width: savedBounds?.width || defaultWidth,
    height: savedBounds?.height || defaultHeight,
    x: savedBounds?.x ?? defaultX,
    y: savedBounds?.y ?? defaultY,
    frame: false,           // 无边框
    transparent: true,      // 透明背景
    alwaysOnTop: true,      // 置顶
    resizable: false,       // 不可调整大小
    skipTaskbar: true,      // 不显示在任务栏
    hasShadow: false,       // 无阴影
    show: false,            // 先隐藏
    // 修复 Windows 上透明窗口首次拖拽失灵的问题
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载悬浮窗页面
  if (process.env.NODE_ENV === 'development') {
    await widgetWindow.loadURL('http://localhost:5173/#/widget');
  } else {
    await widgetWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: '/widget'
    });
  }

  // 保存窗口位置
  widgetWindow.on('moved', () => {
    if (widgetWindow) {
      store.set('widgetBounds', widgetWindow.getBounds());
    }
  });

  // 关闭时隐藏而不是退出
  widgetWindow.on('close', (event) => {
    if (!forceQuit) {
      event.preventDefault();
      widgetWindow?.hide();
      // 更新设置中的悬浮窗状态
      const settings = store.get('settings');
      store.set('settings', { ...settings, showWidget: false });
    }
  });

  return widgetWindow;
}

/**
 * 创建设置窗口
 */
export async function createSettingsWindow(): Promise<BrowserWindow> {
  // 如果设置窗口已存在，直接显示
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 580;
  const windowHeight = 600;

  settingsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    frame: false,           // 无系统边框，使用自定义标题栏
    transparent: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    backgroundColor: '#1f2937',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 窗口准备好后显示
  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  // 加载设置页面
  if (process.env.NODE_ENV === 'development') {
    await settingsWindow.loadURL('http://localhost:5173/#/settings');
  } else {
    await settingsWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
      hash: '/settings'
    });
  }

  // 关闭时销毁
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

/**
 * 获取悬浮窗实例
 */
export function getWidgetWindow(): BrowserWindow | null {
  return widgetWindow;
}

/**
 * 获取设置窗口实例
 */
export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

/**
 * 显示悬浮窗
 */
export function showWidgetWindow(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.show();
    // 更新设置
    const settings = store.get('settings');
    store.set('settings', { ...settings, showWidget: true });
  }
}

/**
 * 隐藏悬浮窗
 */
export function hideWidgetWindow(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide();
    // 更新设置
    const settings = store.get('settings');
    store.set('settings', { ...settings, showWidget: false });
  }
}

/**
 * 切换悬浮窗显示状态
 */
export function toggleWidgetWindow(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    if (widgetWindow.isVisible()) {
      hideWidgetWindow();
    } else {
      showWidgetWindow();
    }
  }
}

/**
 * 悬浮窗是否可见
 */
export function isWidgetVisible(): boolean {
  return widgetWindow?.isVisible() ?? false;
}

/**
 * 显示设置窗口
 */
export function showSettingsWindow(): void {
  createSettingsWindow();
}

/**
 * 关闭设置窗口
 */
export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
}

// 兼容旧代码的别名
export const getMainWindow = getWidgetWindow;
export const showMainWindow = showWidgetWindow;
export const hideMainWindow = hideWidgetWindow;
