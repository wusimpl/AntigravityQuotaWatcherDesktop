/**
 * 主进程国际化模块
 */
import { app } from 'electron';
import { store } from './store';

export type Language = 'zh-CN' | 'en' | 'auto';

// 中文翻译
const zhCN = {
  tray: {
    showWidget: '显示悬浮窗',
    hideWidget: '隐藏悬浮窗',
    refreshNow: '立即刷新',
    settings: '设置',
    about: '关于',
    exit: '退出',
    aboutTitle: '关于 Float',
    aboutMessage: 'Float',
    aboutDetail: '版本: {version}\n\n监控 Google Antigravity AI 模型配额的桌面应用\n\n作者: @wusimpl',
  },
};

// 英文翻译
const en = {
  tray: {
    showWidget: 'Show Widget',
    hideWidget: 'Hide Widget',
    refreshNow: 'Refresh Now',
    settings: 'Settings',
    about: 'About',
    exit: 'Exit',
    aboutTitle: 'About Float',
    aboutMessage: 'Float',
    aboutDetail: 'Version: {version}\n\nDesktop app for monitoring Google Antigravity AI model quota\n\nAuthor: @wusimpl',
  },
};

type Translations = typeof zhCN;

const locales: Record<string, Translations> = {
  'zh-CN': zhCN,
  'en': en,
};

/**
 * 获取系统语言
 */
function getSystemLanguage(): 'zh-CN' | 'en' {
  const locale = app.getLocale();
  if (locale.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

/**
 * 解析语言设置
 */
function resolveLanguage(language: Language): 'zh-CN' | 'en' {
  if (language === 'auto') {
    return getSystemLanguage();
  }
  return language;
}

/**
 * 获取当前语言设置
 */
export function getCurrentLanguage(): 'zh-CN' | 'en' {
  const settings = store.get('settings');
  return resolveLanguage(settings.language);
}

/**
 * 获取翻译对象
 */
export function getTranslations(): Translations {
  const lang = getCurrentLanguage();
  return locales[lang] || locales['en'];
}

/**
 * 格式化消息（支持 {key} 占位符）
 */
export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

/**
 * 获取托盘菜单翻译
 */
export function getTrayTranslations() {
  const t = getTranslations();
  return t.tray;
}
