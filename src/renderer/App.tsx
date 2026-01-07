/**
 * 应用入口 - 根据路由显示不同页面
 */
import React, { useEffect, useState } from 'react';
import Widget from './components/Widget';
import SettingsPage from './components/SettingsPage';
import { I18nProvider } from './i18n/I18nContext';
import type { Language } from './i18n';

const App: React.FC = () => {
  const [route, setRoute] = useState<string>('');
  const [language, setLanguage] = useState<Language>('auto');

  useEffect(() => {
    // 获取当前路由
    const hash = window.location.hash.replace('#', '') || '/widget';
    setRoute(hash);

    // 监听路由变化
    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#', '') || '/widget';
      setRoute(newHash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 加载语言设置
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const data = await window.electronAPI?.getSettings();
        if (data?.settings?.language) {
          setLanguage(data.settings.language);
        }
      } catch (err) {
        console.error('Failed to load language setting:', err);
      }
    };
    loadLanguage();

    // 监听设置更新
    const unsubscribe = window.electronAPI?.onSettingsUpdate?.((data) => {
      if (data?.settings?.language) {
        setLanguage(data.settings.language);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // 根据路由渲染不同页面
  const content = route === '/settings' ? <SettingsPage /> : <Widget />;

  return (
    <I18nProvider initialLanguage={language}>
      {content}
    </I18nProvider>
  );
};

export default App;
