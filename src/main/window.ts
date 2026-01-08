/**
 * 窗口管理模块
 * 管理悬浮窗（widget）和设置窗口
 */
import { BrowserWindow, screen, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { store } from './store';
import { logger } from './logger';

let widgetWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let forceQuit = false;

const WIDGET_BASE_HEIGHT_PX = 86;
const WIDGET_SINGLE_WIDTH_PX = 150;
const WIDGET_DOUBLE_WIDTH_PX = 280;
const WIDGET_SAFETY_MARGIN_PX = 80; // 扩大边距以容纳光晕和阴影效果

// 监听 app 退出前事件，设置强制退出标志
app.on('before-quit', () => {
  forceQuit = true;
});

/**
 * 获取图标路径
 */
function getIconPath(): string {
  const unpackedResourcesPath = path.join(process.resourcesPath, 'resources');
  const resourcesBasePath =
    app.isPackaged && fs.existsSync(unpackedResourcesPath)
      ? unpackedResourcesPath
      : path.join(app.getAppPath(), 'resources');

  // Windows 上使用 ico 效果更好，但 Electron 也支持 png
  // 这里优先使用 png，因为它是通用的
  return path.join(resourcesBasePath, 'icon.png');
}

function getWidgetDesiredContentSize(): { width: number; height: number } {
  const settings = store.get('settings') as { widgetScale?: number } | undefined;
  const widgetScale = typeof settings?.widgetScale === 'number' && Number.isFinite(settings.widgetScale)
    ? settings.widgetScale
    : 1;

  const selectedModels = store.get('selectedModels') as Array<unknown> | undefined;
  const modelCount = Array.isArray(selectedModels) && selectedModels.length > 1 ? 2 : 1;
  const baseWidth = modelCount > 1 ? WIDGET_DOUBLE_WIDTH_PX : WIDGET_SINGLE_WIDTH_PX;

  const width = Math.max(1, Math.ceil(baseWidth * widgetScale) + WIDGET_SAFETY_MARGIN_PX);
  const height = Math.max(1, Math.ceil(WIDGET_BASE_HEIGHT_PX * widgetScale) + WIDGET_SAFETY_MARGIN_PX);
  return { width, height };
}

/**
 * 创建悬浮窗（小组件风格，无边框无按钮）
 */
export async function createWidgetWindow(): Promise<BrowserWindow> {
  logger.info('[Window] Creating widget window');
  
  // 获取保存的窗口位置
  const savedBounds = store.get('widgetBounds') as { x: number; y: number; width: number; height: number } | undefined;

  const desiredSize = getWidgetDesiredContentSize();

  // 计算初始位置（右下角）
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const defaultX = screenWidth - desiredSize.width - 20;
  const defaultY = screenHeight - desiredSize.height - 20;

  widgetWindow = new BrowserWindow({
    width: desiredSize.width,
    height: desiredSize.height,
    x: savedBounds?.x ?? defaultX,
    y: savedBounds?.y ?? defaultY,
    useContentSize: true,
    frame: false,           // 无边框
    transparent: true,      // 透明背景
    alwaysOnTop: true,      // 置顶
    resizable: false,       // 不可调整大小
    skipTaskbar: true,      // 不显示在任务栏
    hasShadow: false,       // 无阴影
    show: false,            // 先隐藏
    // 修复 Windows 上透明窗口首次拖拽失灵的问题
    backgroundColor: '#00000000',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载悬浮窗页面
  if (process.env.NODE_ENV === 'development') {
    logger.info('[Window] Loading widget in development mode');
    await widgetWindow.loadURL('http://localhost:5173/#/widget');
  } else {
    logger.info('[Window] Loading widget in production mode');
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

export function resizeWidgetWindowContentSize(contentWidth: number, contentHeight: number): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;

  const width = Math.max(1, Math.round(contentWidth));
  const height = Math.max(1, Math.round(contentHeight));
  const [currentWidth, currentHeight] = widgetWindow.getContentSize();
  if (currentWidth === width && currentHeight === height) return;

  const bounds = widgetWindow.getBounds();
  const newBounds = {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - height) / 2),
    width,
    height,
  };

  widgetWindow.setBounds(newBounds, false);
  store.set('widgetBounds', widgetWindow.getBounds());
}

/**
 * 创建设置窗口
 */
export async function createSettingsWindow(): Promise<BrowserWindow> {
  // 如果设置窗口已存在，直接显示
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    logger.info('[Window] Settings window already exists, focusing');
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  logger.info('[Window] Creating settings window');

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
    icon: getIconPath(),
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
    logger.info('[Window] Loading settings in development mode');
    await settingsWindow.loadURL('http://localhost:5173/#/settings');
  } else {
    logger.info('[Window] Loading settings in production mode');
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
