/**
 * i18n Context Provider
 * 提供全局语言状态管理
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { getTranslations, formatMessage, resolveLanguage, type Language, type Translations } from './index';

interface I18nContextValue {
  t: Translations;
  language: 'zh-CN' | 'en';
  languageSetting: Language;
  setLanguage: (lang: Language) => void;
  format: (template: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: Language;
}

/**
 * i18n Provider 组件
 */
export function I18nProvider({ children, initialLanguage = 'auto' }: I18nProviderProps) {
  const [languageSetting, setLanguageSetting] = useState<Language>(initialLanguage);
  const resolvedLanguage = resolveLanguage(languageSetting);

  // 监听设置变化
  useEffect(() => {
    setLanguageSetting(initialLanguage);
  }, [initialLanguage]);

  // 获取翻译对象
  const t = useMemo(() => getTranslations(languageSetting), [languageSetting]);

  // 设置语言
  const setLanguage = useCallback((lang: Language) => {
    setLanguageSetting(lang);
  }, []);

  // 格式化消息
  const format = useCallback((template: string, params?: Record<string, string | number>) => {
    return formatMessage(template, params);
  }, []);

  const value = useMemo(() => ({
    t,
    language: resolvedLanguage,
    languageSetting,
    setLanguage,
    format,
  }), [t, resolvedLanguage, languageSetting, setLanguage, format]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * 使用 i18n Context 的 Hook
 */
export function useI18nContext(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
}
