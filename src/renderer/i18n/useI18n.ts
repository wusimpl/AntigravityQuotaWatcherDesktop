/**
 * i18n React Hook
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getTranslations, formatMessage, resolveLanguage, type Language, type Translations } from './index';

interface UseI18nResult {
  t: Translations;
  language: 'zh-CN' | 'en';
  setLanguage: (lang: Language) => void;
  format: (template: string, params?: Record<string, string | number>) => string;
}

/**
 * 国际化 Hook
 * @param initialLanguage 初始语言设置
 */
export function useI18n(initialLanguage: Language = 'auto'): UseI18nResult {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const resolvedLanguage = resolveLanguage(language);
  
  // 获取翻译对象
  const t = useMemo(() => getTranslations(language), [language]);

  // 设置语言
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  // 格式化消息
  const format = useCallback((template: string, params?: Record<string, string | number>) => {
    return formatMessage(template, params);
  }, []);

  return {
    t,
    language: resolvedLanguage,
    setLanguage,
    format,
  };
}

/**
 * 创建带语言参数的格式化函数
 */
export function createFormatter(language: Language) {
  const t = getTranslations(language);
  
  return {
    t,
    format: (template: string, params?: Record<string, string | number>) => {
      return formatMessage(template, params);
    },
  };
}
