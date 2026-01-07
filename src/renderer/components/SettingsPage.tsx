/**
 * 设置页面 - 独立窗口
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, ModelConfig, SelectedModel, AccountModelConfigs, QuotaSnapshot } from '../../shared/types';
import LoginDialog from './LoginDialog';

// 独立的模型行组件，避免输入时父组件重渲染导致失焦
interface ModelRowProps {
  accountId: string;
  model: { modelId: string; displayName: string; remainingPercentage?: number; resetTime?: string };
  config: ModelConfig;
  isSelected: boolean;
  canSelect: boolean;
  onToggleSelect: (accountId: string, modelId: string) => void;
  onAliasChange: (accountId: string, modelId: string, alias: string) => void;
}

// 格式化重置时间为相对时间
const formatResetTime = (resetTime?: string): string => {
  if (!resetTime) return '-';
  const reset = new Date(resetTime);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();
  
  if (diffMs <= 0) return '已重置';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `${days}天后`;
  }
  if (diffHours > 0) {
    return `${diffHours}小时${diffMins}分`;
  }
  return `${diffMins}分钟`;
};

const ModelRow: React.FC<ModelRowProps> = React.memo(({ 
  accountId, 
  model, 
  config, 
  isSelected, 
  canSelect,
  onToggleSelect, 
  onAliasChange 
}) => {
  // 本地 state 控制输入框，避免每次按键触发父组件重渲染
  const [localAlias, setLocalAlias] = useState(config.alias);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 当外部 config.alias 变化时同步本地状态
  useEffect(() => {
    setLocalAlias(config.alias);
  }, [config.alias]);

  // 处理别名输入，使用防抖保存
  const handleAliasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalAlias(newValue);

    // 清除之前的防抖定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 300ms 后保存，避免频繁触发保存
    debounceRef.current = setTimeout(() => {
      onAliasChange(accountId, model.modelId, newValue);
    }, 300);
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleToggle = () => {
    if (isSelected || canSelect) {
      onToggleSelect(accountId, model.modelId);
    }
  };

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      isSelected ? 'bg-blue-900/30 border border-blue-500/30' : 'bg-gray-800'
    }`}>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleToggle}
          disabled={!isSelected && !canSelect}
          className="sr-only peer"
        />
        <div className={`w-8 h-4 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all ${
          !isSelected && !canSelect 
            ? 'bg-gray-700 cursor-not-allowed after:bg-gray-400' 
            : 'bg-gray-600 peer-checked:bg-blue-600'
        }`}></div>
      </label>
      <span className="text-sm text-gray-300 flex-1 truncate" title={model.modelId}>
        {model.displayName}
      </span>
      <span className={`w-12 text-xs text-center ${
        (model.remainingPercentage ?? 100) <= 30 
          ? 'text-red-400' 
          : (model.remainingPercentage ?? 100) <= 50 
            ? 'text-yellow-400' 
            : 'text-green-400'
      }`}>
        {model.remainingPercentage !== undefined ? `${Math.round(model.remainingPercentage)}%` : '-'}
      </span>
      <span className="w-20 text-xs text-gray-400 text-center" title={model.resetTime}>
        {formatResetTime(model.resetTime)}
      </span>
      <input
        type="text"
        value={localAlias}
        onChange={handleAliasChange}
        placeholder="别名"
        className="w-24 px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
});
ModelRow.displayName = 'ModelRow';

interface AccountInfo {
  id: string;
  email: string;
}

interface ModelInfo {
  modelId: string;
  displayName: string;
  remainingPercentage?: number;
  resetTime?: string;
}

// 账户配额数据（包含模型列表）
interface AccountQuotaData {
  account: AccountInfo;
  models: ModelInfo[];
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    pollingInterval: 60,
    warningThreshold: 50,
    criticalThreshold: 30,
    autoStart: false,
    notifications: true,
    showWidget: false,
    widgetScale: 1,
    showResetTimeInWidget: true,
    language: 'auto',
  });
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>({});
  const [accountModelConfigs, setAccountModelConfigs] = useState<AccountModelConfigs>({});
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [accountQuotas, setAccountQuotas] = useState<AccountQuotaData[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // 从 displayName 提取默认别名（取第一个单词）
  const getDefaultAlias = (displayName: string): string => {
    return displayName.split(/\s+/)[0] || '';
  };

  // 加载设置
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const [data, accountList, allQuotas] = await Promise.all([
        window.electronAPI?.getSettings(),
        window.electronAPI?.getAccounts(),
        window.electronAPI?.getAllQuotas(),
      ]);

      if (data) {
        setSettings(data.settings);
        setModelConfigs(data.modelConfigs || {});
        setAccountModelConfigs(data.accountModelConfigs || {});
        setSelectedModels(data.selectedModels || []);
      }
      setAccounts(accountList || []);

      // 构建每个账户的模型列表
      if (accountList && allQuotas) {
        const quotaData: AccountQuotaData[] = accountList.map(account => {
          const snapshot = allQuotas[account.id] as QuotaSnapshot | undefined;
          const models = snapshot?.models?.map(m => ({
            modelId: m.modelId,
            displayName: m.displayName,
            remainingPercentage: m.remainingPercentage,
            resetTime: m.resetTime,
          })) || [];
          return { account, models };
        });
        setAccountQuotas(quotaData);

        // 为新模型生成默认配置
        const updatedConfigs = { ...data?.accountModelConfigs || {} };
        let hasNewConfigs = false;
        for (const { account, models } of quotaData) {
          if (!updatedConfigs[account.id]) {
            updatedConfigs[account.id] = {};
          }
          for (const model of models) {
            if (!updatedConfigs[account.id][model.modelId]) {
              updatedConfigs[account.id][model.modelId] = {
                visible: true,
                alias: getDefaultAlias(model.displayName),
                order: 0,
              };
              hasNewConfigs = true;
            }
          }
        }
        if (hasNewConfigs) {
          setAccountModelConfigs(updatedConfigs);
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 订阅配额更新：让“重置时间/配额”展示跟随最新快照，避免设置页与悬浮窗显示不一致
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onQuotaUpdate((data: { accountId: string; snapshot: QuotaSnapshot }) => {
      const models = (data.snapshot?.models || []).map(m => ({
        modelId: m.modelId,
        displayName: m.displayName,
        remainingPercentage: m.remainingPercentage,
        resetTime: m.resetTime,
      }));

      setAccountQuotas(prev =>
        prev.map(item => (item.account.id === data.accountId ? { ...item, models } : item))
      );

      // 如果出现新模型，补齐默认配置（不触发保存，等用户后续操作再保存）
      setAccountModelConfigs(prev => {
        const existing = prev[data.accountId] || {};
        let changed = false;
        const nextAccountConfigs: Record<string, ModelConfig> = { ...existing };

        for (const model of models) {
          if (!nextAccountConfigs[model.modelId]) {
            const defaultAlias = model.displayName.split(/\s+/)[0] || '';
            nextAccountConfigs[model.modelId] = { visible: true, alias: defaultAlias, order: 0 };
            changed = true;
          }
        }

        if (!changed) return prev;
        return { ...prev, [data.accountId]: nextAccountConfigs };
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // 1s 防抖保存设置：1 秒内多次修改，只保存最后一次
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePendingRef = useRef(false);
  const latestSettingsRef = useRef<AppSettings>(settings);
  const latestModelConfigsRef = useRef<Record<string, ModelConfig>>(modelConfigs);
  const latestAccountModelConfigsRef = useRef<AccountModelConfigs>(accountModelConfigs);
  const latestSelectedModelsRef = useRef<SelectedModel[]>(selectedModels);

  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    latestModelConfigsRef.current = modelConfigs;
  }, [modelConfigs]);

  useEffect(() => {
    latestAccountModelConfigsRef.current = accountModelConfigs;
  }, [accountModelConfigs]);

  useEffect(() => {
    latestSelectedModelsRef.current = selectedModels;
  }, [selectedModels]);

  const scheduleSaveSettings = useCallback(() => {
    savePendingRef.current = true;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;

      if (!savePendingRef.current) return;
      savePendingRef.current = false;

      try {
        await window.electronAPI?.saveSettings({
          settings: latestSettingsRef.current,
          modelConfigs: latestModelConfigsRef.current,
          accountModelConfigs: latestAccountModelConfigsRef.current,
          selectedModels: latestSelectedModelsRef.current,
        });
      } catch (err) {
        console.error('Failed to save settings:', err);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (savePendingRef.current) {
        savePendingRef.current = false;
        void window.electronAPI?.saveSettings({
          settings: latestSettingsRef.current,
          modelConfigs: latestModelConfigsRef.current,
          accountModelConfigs: latestAccountModelConfigsRef.current,
          selectedModels: latestSelectedModelsRef.current,
        });
      }
    };
  }, []);

  // 更新设置项（1s 防抖保存）
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      latestSettingsRef.current = newSettings;
      scheduleSaveSettings();
      return newSettings;
    });
  };

  // 切换模型选中状态
  const handleToggleSelect = (accountId: string, modelId: string) => {
    setSelectedModels(prev => {
      const isCurrentlySelected = prev.some(s => s.accountId === accountId && s.modelId === modelId);
      let newSelected: SelectedModel[];
      
      if (isCurrentlySelected) {
        // 取消选中
        newSelected = prev.filter(s => !(s.accountId === accountId && s.modelId === modelId));
      } else if (prev.length < 2) {
        // 添加选中（最多2个）
        newSelected = [...prev, { accountId, modelId }];
      } else {
        // 已经有2个了，不能再添加
        return prev;
      }
      
      latestSelectedModelsRef.current = newSelected;
      scheduleSaveSettings();
      return newSelected;
    });
  };

  // 更新模型别名
  const handleAliasChange = (accountId: string, modelId: string, alias: string) => {
    setAccountModelConfigs(prev => {
      const newConfigs = {
        ...prev,
        [accountId]: {
          ...prev[accountId],
          [modelId]: {
            ...(prev[accountId]?.[modelId] || { visible: true, order: 0 }),
            alias,
          },
        },
      };
      latestAccountModelConfigsRef.current = newConfigs;
      scheduleSaveSettings();
      return newConfigs;
    });
  };

  // 获取模型配置
  const getModelConfig = (accountId: string, modelId: string): ModelConfig => {
    return accountModelConfigs[accountId]?.[modelId] || { visible: true, alias: '', order: 0 };
  };

  // 检查模型是否被选中
  const isModelSelected = (accountId: string, modelId: string): boolean => {
    return selectedModels.some(s => s.accountId === accountId && s.modelId === modelId);
  };

  // 是否还能选择更多模型
  const canSelectMore = selectedModels.length < 2;

  // 添加账户
  const handleAddAccount = () => {
    setShowLoginDialog(true);
  };

  // 登录成功回调
  const handleLoginSuccess = async () => {
    setShowLoginDialog(false);
    // 登录成功后，先刷新配额数据（获取模型列表），再加载设置
    await window.electronAPI?.refreshQuota();
    await loadSettings();
  };

  // 关闭登录弹窗
  const handleLoginDialogClose = () => {
    setShowLoginDialog(false);
  };

  // 删除账户
  const handleDeleteAccount = async (accountId: string) => {
    if (deleteConfirm === accountId) {
      try {
        await window.electronAPI?.logout(accountId);
        // 移除该账户的选中模型
        setSelectedModels(prev => {
          const newSelected = prev.filter(s => s.accountId !== accountId);
          latestSelectedModelsRef.current = newSelected;
          return newSelected;
        });
        // 重新加载
        await loadSettings();
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
    await loadSettings();
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
      {/* 登录弹窗 */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={handleLoginDialogClose}
        onSuccess={handleLoginSuccess}
      />

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
          <div className="px-3 py-3 bg-gray-800 rounded-lg space-y-4">
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

            {/* 悬浮窗大小滑动条 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">悬浮窗大小</span>
                <span className="text-sm text-gray-300">{Math.round((settings.widgetScale || 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={150}
                step={5}
                value={(settings.widgetScale || 1) * 100}
                onChange={e => updateSetting('widgetScale', parseInt(e.target.value) / 100)}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>50%</span>
                <span>100%</span>
                <span>150%</span>
              </div>
            </div>

            {/* 显示重置时间开关 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-200">显示重置时间</span>
                <p className="text-xs text-gray-500 mt-0.5">在悬浮窗中显示配额重置倒计时</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showResetTimeInWidget ?? true}
                  onChange={e => updateSetting('showResetTimeInWidget', e.target.checked)}
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
                  className={`ml-2 px-2 py-1 text-xs rounded transition-colors ${deleteConfirm === account.id
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
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">模型显示开关</h3>
            <span className="text-xs text-gray-500">
              已选 {selectedModels.length}/2 个模型
            </span>
          </div>
          
          {accountQuotas.length === 0 ? (
            <div className="text-sm text-gray-500 py-2 px-3 bg-gray-800 rounded-lg">
              暂无模型数据，请先登录账户
            </div>
          ) : (
            <div className="space-y-4">
              {accountQuotas.map(({ account, models }) => (
                <div key={account.id} className="bg-gray-800/50 rounded-lg overflow-hidden">
                  {/* 账户标题 */}
                  <div className="px-3 py-2 bg-gray-700/50 border-b border-gray-700 flex items-center gap-3">
                    <span className="w-8"></span>
                    <span className="text-sm text-gray-300 flex-1 truncate">{account.email}</span>
                    <span className="w-12 text-xs text-gray-500 text-center">配额</span>
                    <span className="w-20 text-xs text-gray-500 text-center">重置时间</span>
                    <span className="w-24 text-xs text-gray-500 text-center">别名</span>
                  </div>
                  
                  {/* 模型列表 - 限制高度可滚动 */}
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1.5">
                    {models.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2 px-2">
                        暂无模型数据
                      </div>
                    ) : (
                      models.map(model => (
                        <ModelRow
                          key={`${account.id}-${model.modelId}`}
                          accountId={account.id}
                          model={model}
                          config={getModelConfig(account.id, model.modelId)}
                          isSelected={isModelSelected(account.id, model.modelId)}
                          canSelect={canSelectMore}
                          onToggleSelect={handleToggleSelect}
                          onAliasChange={handleAliasChange}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button
            className="w-full mt-3 px-3 py-2 text-sm text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg border border-dashed border-gray-600 transition-colors"
            onClick={handleRefreshModels}
          >
            刷新模型列表
          </button>
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
        <section className="text-center text-xs text-gray-500 pb-4 space-y-1">
          <div>AG Quota Watcher Desktop</div>
          <div>监控 Google Antigravity AI 模型配额</div>
          <div>作者: @wusimpl</div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
