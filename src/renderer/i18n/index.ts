/**
 * 国际化模块
 * 轻量级 i18n 实现，无需额外依赖
 */
import { zhCN, type Translations } from './locales/zh-CN';
import { en } from './locales/en';

export type Language = 'zh-CN' | 'en' | 'auto';

// 语言包映射
const locales: Record<string, Translations> = {
  'zh-CN': zhCN,
  'en': en,
};

/**
 * 获取系统语言
 */
export function getSystemLanguage(): 'zh-CN' | 'en' {
  const lang = navigator.language || 'en';
  // 中文环境返回 zh-CN，其他返回 en
  if (lang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

/**
 * 解析语言设置
 */
export function resolveLanguage(language: Language): 'zh-CN' | 'en' {
  if (language === 'auto') {
    return getSystemLanguage();
  }
  return language;
}

/**
 * 获取翻译文本
 */
export function getTranslations(language: Language): Translations {
  const resolvedLang = resolveLanguage(language);
  return locales[resolvedLang] || locales['en'];
}

/**
 * 模板字符串替换
 * 支持 {key} 格式的占位符
 */
export function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

// 导出类型
export type { Translations };
export { zhCN, en };
