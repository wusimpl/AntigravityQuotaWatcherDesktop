/**
 * 悬浮窗组件 - 纯扁平小组件风格
 * 类似360悬浮球，无标题栏无按钮
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { ModelQuotaInfo, QuotaSnapshot, AppSettings, ModelConfig } from '../../shared/types';
import { getQuotaLevel, QuotaLevel } from '../../shared/types';

interface AccountInfo {
  id: string;
  email: string;
}

const Widget: React.FC = () => {
  const [activeAccount, setActiveAccount] = useState<AccountInfo | null>(null);
  const [quotaData, setQuotaData] = useState<ModelQuotaInfo[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    pollingInterval: 60,
    warningThreshold: 50,
    criticalThreshold: 30,
    autoStart: false,
    notifications: true,
    showWidget: true,
    language: 'auto',
  });
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfig>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [active, settingsData, snapshot] = await Promise.all([
        window.electronAPI?.getActiveAccount(),
        window.electronAPI?.getSettings(),
        window.electronAPI?.getQuota(),
      ]);

      setActiveAccount(active || null);
      if (settingsData) {
        setSettings(settingsData.settings);
        setModelConfigs(settingsData.modelConfigs || {});
      }
      if (snapshot?.models) {
        setQuotaData(snapshot.models);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 监听配额更新
  useEffect(() => {
    const handleQuotaUpdate = (data: { accountId: string; snapshot: QuotaSnapshot }) => {
      if (activeAccount && data.accountId === activeAccount.id) {
        setQuotaData(data.snapshot.models);
      }
    };

    window.electronAPI?.onQuotaUpdate(handleQuotaUpdate);
  }, [activeAccount]);

  // 监听设置更新
  useEffect(() => {
    const handleSettingsUpdate = (data: { settings: AppSettings; modelConfigs: Record<string, ModelConfig> }) => {
      setSettings(data.settings);
      setModelConfigs(data.modelConfigs);
    };

    window.electronAPI?.onSettingsUpdate?.(handleSettingsUpdate);
  }, []);

  // 过滤和排序模型（固定顺序，避免刷新时位置变化）
  const getFilteredModels = (): ModelQuotaInfo[] => {
    return quotaData
      .filter(model => modelConfigs[model.modelId]?.visible !== false)
      .map(model => ({
        ...model,
        alias: modelConfigs[model.modelId]?.alias || model.alias,
      }))
      .sort((a, b) => {
        const orderA = modelConfigs[a.modelId]?.order ?? 999;
        const orderB = modelConfigs[b.modelId]?.order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        // 次级排序：按 modelId 字母顺序，确保稳定性
        return a.modelId.localeCompare(b.modelId);
      })
      .slice(0, 2); // 限制为2个，“双生胶囊”
  };

  const filteredModels = getFilteredModels();

  // 获取状态颜色 (圆点/文本)
  const getStatusColor = (percentage: number): string => {
    const level = getQuotaLevel(percentage, settings.warningThreshold, settings.criticalThreshold);
    switch (level) {
      case QuotaLevel.Depleted: return 'bg-gray-500';
      case QuotaLevel.Critical: return 'bg-red-500';
      case QuotaLevel.Warning: return 'bg-yellow-500';
      default: return 'bg-emerald-400'; // 使用翡翠绿，更高级
    }
  };

  // 辅助组件：单个模型展示单元
  const ModelUnit = ({ model, align = 'left' }: { model: ModelQuotaInfo; align?: 'left' | 'right' }) => (
    <div className={`flex flex-col items-${align === 'left' ? 'start' : 'end'} justify-center min-w-[70px]`}>
      <div className="flex items-center gap-1.5">
        {align === 'left' && (
          <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${getStatusColor(model.remainingPercentage)}`} />
        )}
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium truncate max-w-[60px]">
          {model.alias || model.displayName?.split(' ')[0] || 'MODEL'}
        </span>
        {align === 'right' && (
          <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${getStatusColor(model.remainingPercentage)}`} />
        )}
      </div>
      <div className={`text-sm font-bold text-gray-100 font-mono leading-none mt-0.5 ${model.remainingPercentage < settings.criticalThreshold ? 'text-red-400' : ''
        }`}>
        {Math.round(model.remainingPercentage)}%
      </div>
    </div>
  );

  // 公共容器样式：胶囊形状 + 毛玻璃 + 拖拽支持
  const containerClass = "drag-region flex items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-hidden transition-all duration-300 hover:bg-black/70 hover:border-white/20";

  // --------------------------------------------------------------------------
  // 渲染逻辑
  // --------------------------------------------------------------------------

  // State 1: 未登录 / 加载中
  if ((!activeAccount || isLoading) && filteredModels.length === 0) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-transparent">
        <div className={`${containerClass} px-4 py-2`}>
          <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse mr-2" />
          <span className="text-xs text-gray-300 font-medium whitespace-nowrap">
            {isLoading ? 'Loading...' : 'Not Signed In'}
          </span>
        </div>
      </div>
    );
  }

  // State 2: 无数据
  if (filteredModels.length === 0) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-transparent">
        <div className={`${containerClass} px-4 py-2`}>
          <span className="text-xs text-gray-400 whitespace-nowrap">No Models</span>
        </div>
      </div>
    );
  }

  // State 3: 单个模型 (Single Mode)
  // 紧凑型胶囊: [ ● Name 95% ]
  if (filteredModels.length === 1) {
    const model = filteredModels[0];
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-transparent">
        <div className={`${containerClass} px-4 py-2.5 gap-3`}>
          <div className={`w-2 h-2 rounded-full ${getStatusColor(model.remainingPercentage)} shadow-[0_0_10px_currentColor]`} />
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5 max-w-[80px] truncate">
              {model.alias || model.displayName?.split(' ')[0] || 'MODEL'}
            </span>
            <span className="text-sm font-bold text-white font-mono leading-none">
              {Math.round(model.remainingPercentage)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  // State 4: 双模型 (Dual Mode) - "Binary Capsule"
  // 分体式胶囊: [ Left 90% | Right 45% ]
  return (
    <div className="flex items-center justify-center w-screen h-screen bg-transparent">
      <div className={`${containerClass} px-5 py-2`}>
        {/* Left Unit */}
        <ModelUnit model={filteredModels[0]} align="left" />

        {/* Elegant Separator */}
        <div className="w-px h-6 bg-gradient-to-b from-transparent via-white/20 to-transparent mx-4" />

        {/* Right Unit */}
        <ModelUnit model={filteredModels[1]} align="right" />
      </div>
    </div>
  );
};

export default Widget;
