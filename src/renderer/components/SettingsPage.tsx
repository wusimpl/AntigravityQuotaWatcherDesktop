/**
 * 设置页面 - 独立窗口
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ModelConfig } from '../../shared/types';

interface AccountInfo {
  id: string;
  email: string;
}

interface ModelInfo {
  modelId: string;
  displayName: string;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    pollingInterval: 60,
    warningThreshold: 50,
    criticalThreshold: 30,
    autoStart: false,
    notifications: true,
    showWidget: false,
    language: 'auto',
  });
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>({});
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const [data, accountList, models] = await Promise.all([
        window.electronAPI?.getSettings(),
        window.electronAPI?.getAccounts(),
        window.electronAPI?.getAvailableModels(),
      ]);
      
      if (data) {
        setSettings(data.settings);
        setModelConfigs(data.modelConfigs || {});
      }
      setAccounts(accountList || []);
      setAvailableModels(models || []);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 即时保存设置
  const saveSettingsImmediate = useCallback(async (newSettings: AppSettings, newModelConfigs: Record<string, ModelConfig>) => {
    try {
      await window.electronAPI?.saveSettings({ settings: newSettings, modelConfigs: newModelConfigs });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, []);

  // 更新设置项（即时保存）
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      saveSettingsImmediate(newSettings, modelConfigs);
      return newSettings;
    });
  };

  // 更新模型配置（即时保存）
  const updateModelConfig = (modelId: string, updates: Partial<ModelConfig>) => {
    setModelConfigs(prev => {
      const newModelConfigs = {
        ...prev,
        [modelId]: {
          visible: prev[modelId]?.visible ?? true,
          alias: prev[modelId]?.alias ?? '',
          order: prev[modelId]?.order ?? 0,
          ...updates,
        },
      };
      saveSettingsImmediate(settings, newModelConfigs);
      return newModelConfigs;
    });
  };

  // 获取模型配置
  const getModelConfig = (modelId: string): ModelConfig => {
    return modelConfigs[modelId] || { visible: true, alias: '', order: 0 };
  };

  // 添加账户
  const handleAddAccount = async () => {
    try {
      const success = await window.electronAPI?.login();
      if (success) {
        const accountList = await window.electronAPI?.getAccounts();
        setAccounts(accountList || []);
        // 刷新模型列表
        await window.electronAPI?.refreshQuota();
        const models = await window.electronAPI?.getAvailableModels();
        setAvailableModels(models || []);
      }
    } catch (err) {
      console.error('Failed to add account:', err);
    }
  };

  // 删除账户
  const handleDeleteAccount = async (accountId: string) => {
    if (deleteConfirm === accountId) {
      try {
        await window.electronAPI?.logout(accountId);
        const accountList = await window.electronAPI?.getAccounts();
        setAccounts(accountList || []);
      } catch (err) {
        console.error('Failed to delete account:', err);
      }
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(accountId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // 刷新模型列表
  const handleRefreshModels = async () => {
    await window.electronAPI?.refreshQuota();
    const models = await window.electronAPI?.getAvailableModels();
    setAvailableModels(models || []);
  };

  // 窗口控制
  const handleMinimize = () => window.electronAPI?.settingsMinimize();
  const handleClose = () => window.electronAPI?.settingsClose();

  if (isLoading) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col">
      {/* 标题栏 */}
      <div className="drag-region flex items-center px-4 py-3 bg-gray-800 border-b border-gray-700">
        <span className="text-white font-medium">AG Quota 设置</span>
        <div className="flex-1" />
        <div className="no-drag flex items-center gap-1">
          <button
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            onClick={handleMinimize}
            title="最小化"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            className="p-1.5 text-gray-400 hover:text-white hover:bg-red-600 rounded transition-colors"
            onClick={handleClose}
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 设置内容 */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* 悬浮窗设置 */}
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-3">悬浮窗</h3>
          <div className="px-3 py-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-200">显示悬浮窗</span>
                <p className="text-xs text-gray-500 mt-0.5">在桌面显示配额监控小组件</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showWidget}
                  onChange={e => updateSetting('showWidget', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* 账户管理 */}
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-3">账户管理</h3>
          <div className="space-y-2">
            {accounts.map(account => (
              <div
                key={account.id}
                className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg"
              >
                <span className="text-sm text-gray-200 truncate flex-1">{account.email}</span>
                <button
                  className={`ml-2 px-2 py-1 text-xs rounded transition-colors ${
                    deleteConfirm === account.id
                      ? 'bg-red-600 text-white'
                      : 'text-gray-400 hover:text-red-400 hover:bg-gray-700'
                  }`}
                  onClick={() => handleDeleteAccount(account.id)}
                >
                  {deleteConfirm === account.id ? '确认删除' : '删除'}
                </button>
              </div>
            ))}
            <button
              className="w-full px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-800 rounded-lg border border-dashed border-gray-600 transition-colors"
              onClick={handleAddAccount}
            >
              + 添加账户
            </button>
          </div>
        </section>

        {/* 模型配置 */}
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-3">模型配置</h3>
          <div className="space-y-2">
            {availableModels.length === 0 ? (
              <div className="text-sm text-gray-500 py-2">暂无模型数据，请先登录账户</div>
            ) : (
              availableModels.map(model => {
                const config = getModelConfig(model.modelId);
                return (
                  <div
                    key={model.modelId}
                    className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg"
                  >
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.visible}
                        onChange={e => updateModelConfig(model.modelId, { visible: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <span className="text-sm text-gray-300 flex-1 truncate" title={model.modelId}>
                      {model.displayName}
                    </span>
                    <input
                      type="text"
                      value={config.alias}
                      onChange={e => updateModelConfig(model.modelId, { alias: e.target.value })}
                      placeholder="别名"
                      className="w-24 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                );
              })
            )}
            <button
              className="w-full px-3 py-2 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg border border-dashed border-gray-600 transition-colors"
              onClick={handleRefreshModels}
            >
              刷新模型列表
            </button>
          </div>
        </section>

        {/* 显示设置 */}
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-3">显示设置</h3>
          <div className="space-y-3 px-3 py-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">刷新频率</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={settings.pollingInterval}
                  onChange={e => updateSetting('pollingInterval', Math.max(10, parseInt(e.target.value) || 60))}
                  className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 text-center focus:outline-none focus:border-blue-500"
                />
                <span className="text-sm text-gray-500">秒</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">警告阈值</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.warningThreshold}
                  onChange={e => updateSetting('warningThreshold', Math.min(100, Math.max(0, parseInt(e.target.value) || 50)))}
                  className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 text-center focus:outline-none focus:border-blue-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">紧急阈值</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.criticalThreshold}
                  onChange={e => updateSetting('criticalThreshold', Math.min(100, Math.max(0, parseInt(e.target.value) || 30)))}
                  className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 text-center focus:outline-none focus:border-blue-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </div>
        </section>

        {/* 系统设置 */}
        <section>
          <h3 className="text-sm font-medium text-gray-300 mb-3">系统设置</h3>
          <div className="space-y-3 px-3 py-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">开机自启</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoStart}
                  onChange={e => updateSetting('autoStart', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">系统通知</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={e => updateSetting('notifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">语言</span>
              <select
                value={settings.language}
                onChange={e => updateSetting('language', e.target.value as AppSettings['language'])}
                className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-blue-500"
              >
                <option value="auto">跟随系统</option>
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        {/* 版本信息 */}
        <section className="text-center text-xs text-gray-500 pb-4">
          AG Quota Desktop
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
