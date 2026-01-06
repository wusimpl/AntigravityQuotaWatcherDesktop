/**
 * 应用入口 - 根据路由显示不同页面
 */
import React, { useEffect, useState } from 'react';
import Widget from './components/Widget';
import SettingsPage from './components/SettingsPage';

const App: React.FC = () => {
  const [route, setRoute] = useState<string>('');

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

  // 根据路由渲染不同页面
  if (route === '/settings') {
    return <SettingsPage />;
  }

  // 默认显示悬浮窗
  return <Widget />;
};

export default App;
