/**
 * 悬浮窗组件 - 双生能量胶囊 (Binary Energy Capsule)
 * 高保真还原设计图：玻璃拟态、冷暖对撞、3D质感、水箱效果
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { QuotaSnapshot, AppSettings, ModelConfig, SelectedModel, AccountModelConfigs } from '../../shared/types';
import { getQuotaLevel, QuotaLevel } from '../../shared/types';
import './Widget.css';

// 用于显示的模型数据（包含配额和配置）
interface DisplayModel {
  accountId: string;
  modelId: string;
  displayName: string;
  alias: string;
  remainingPercentage: number;
  resetTime?: string;
}

const MAX_VISIBLE_MODELS = 2;

// 格式化重置时间为简化格式（只显示最大单位）
const formatResetTimeSimple = (resetTime?: string): string => {
  if (!resetTime) return '';
  const reset = new Date(resetTime);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();
  
  if (diffMs <= 0) return '';
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // 超过1天显示天数
  if (diffDays >= 1) {
    return `${diffDays}D`;
  }
  // 超过1小时显示小时数
  if (diffHours >= 1) {
    return `${diffHours}H`;
  }
  // 否则显示分钟数
  return `${diffMins}Min`;
};

const Widget: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    pollingInterval: 60,
    warningThreshold: 50,
    criticalThreshold: 30,
    autoStart: false,
    notifications: true,
    showWidget: true,
    widgetScale: 1,
    showResetTimeInWidget: true,
    language: 'auto',
  });
  const [accountModelConfigs, setAccountModelConfigs] = useState<AccountModelConfigs>({});
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [allQuotas, setAllQuotas] = useState<Record<string, QuotaSnapshot>>({});
  const [isLoading, setIsLoading] = useState(true);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [settingsData, quotas] = await Promise.all([
        window.electronAPI?.getSettings(),
        window.electronAPI?.getAllQuotas(),
      ]);

      if (settingsData) {
        setSettings(settingsData.settings);
        setAccountModelConfigs(settingsData.accountModelConfigs || {});
        setSelectedModels(settingsData.selectedModels || []);
      }
      if (quotas) {
        setAllQuotas(quotas);
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
      setAllQuotas(prev => ({
        ...prev,
        [data.accountId]: data.snapshot,
      }));
    };

    const unsubscribe = window.electronAPI?.onQuotaUpdate(handleQuotaUpdate);
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // 监听设置更新
  useEffect(() => {
    const handleSettingsUpdate = (data: { 
      settings: AppSettings; 
      modelConfigs: Record<string, ModelConfig>;
      accountModelConfigs: AccountModelConfigs;
      selectedModels: SelectedModel[];
    }) => {
      setSettings(data.settings);
      setAccountModelConfigs(data.accountModelConfigs || {});
      setSelectedModels(data.selectedModels || []);
    };

    const unsubscribe = window.electronAPI?.onSettingsUpdate?.(handleSettingsUpdate);
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // 获取要显示的模型数据
  const getDisplayModels = (): DisplayModel[] => {
    const models: DisplayModel[] = [];
    for (const selected of selectedModels) {
      const snapshot = allQuotas[selected.accountId];
      const modelData = snapshot?.models?.find(m => m.modelId === selected.modelId);
      if (!modelData) continue;

      const config = accountModelConfigs[selected.accountId]?.[selected.modelId];
      models.push({
        accountId: selected.accountId,
        modelId: selected.modelId,
        displayName: modelData.displayName,
        alias: config?.alias || modelData.displayName,
        remainingPercentage: modelData.remainingPercentage,
        resetTime: modelData.resetTime,
      });
      if (models.length >= MAX_VISIBLE_MODELS) break;
    }
    return models;
  };

  const displayModels = getDisplayModels();

  // --- UI Components & Helpers ---

  // SVG Icons
  const GeminiIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3V21M3 12H21M17 7L7 17M7 7L17 17" opacity="0.8" />
      <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" strokeWidth="3" />
    </svg>
  );

  const ClaudeIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2h5a5.5 5.5 0 0 1 5.5 5.5v11a2.5 2.5 0 0 1-2.5 2.5h-11a2.5 2.5 0 0 1-2.5-2.5v-11A5.5 5.5 0 0 1 9.5 2z" />
      <path d="M8 11h.01M16 11h.01M12 16c-1.5 0-3-1-3-2.5h6c0 1.5-1.5 2.5-3 2.5z" />
    </svg>
  );

  // Generic AI Icon for other models
  const BotIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  );

  // 水箱波浪组件
  const WaterTank = ({ percentage, color }: { percentage: number; color: 'blue' | 'orange' }) => {
    const translateY = 100 - Math.max(0, Math.min(100, percentage));
    const colors = color === 'blue' 
      ? { body: 'bg-blue-400', waveBack: 'fill-blue-400', waveFront: 'fill-blue-400' }
      : { body: 'bg-orange-400', waveBack: 'fill-orange-400', waveFront: 'fill-orange-400' };

    return (
      <div 
        className="absolute bottom-0 left-0 w-full h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateY(${translateY}%)` }}
      >
        {/* 水体主体 */}
        <div className={`absolute top-[10px] left-0 w-full h-[200%] ${colors.body}`} />  
        
        {/* 波浪层 */}
        <div className="absolute top-0 w-full h-[20px]">
          {/* 后层波浪 - 较慢 */}
          <div className="wave-container wave-back">
            <div className="wave-tile">
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={`w-full h-full ${colors.waveBack}`}>
                <path d="M0,0V46.29c47,0,116.29,48.27,243.32,48.27s196.32-48.27,333.32-48.27S833,96,960,96s240-48,240-48V0Z" transform="scale(1, -1) translate(0, -96)" />
              </svg>
            </div>
            <div className="wave-tile">
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={`w-full h-full ${colors.waveBack}`}>
                <path d="M0,0V46.29c47,0,116.29,48.27,243.32,48.27s196.32-48.27,333.32-48.27S833,96,960,96s240-48,240-48V0Z" transform="scale(1, -1) translate(0, -96)" />
              </svg>
            </div>
          </div>
          {/* 前层波浪 - 较快 */}
          <div className="wave-container wave-front">
            <div className="wave-tile">
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={`w-full h-full ${colors.waveFront}`}>
                <path d="M0,0V46.29c47,0,116.29,48.27,243.32,48.27s196.32-48.27,333.32-48.27S833,96,960,96s240-48,240-48V0Z" transform="scale(1, -1) translate(0, -96)" />
              </svg>
            </div>
            <div className="wave-tile">
              <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={`w-full h-full ${colors.waveFront}`}>
                <path d="M0,0V46.29c47,0,116.29,48.27,243.32,48.27s196.32-48.27,333.32-48.27S833,96,960,96s240-48,240-48V0Z" transform="scale(1, -1) translate(0, -96)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 根据配额百分比获取颜色样式
  const getQuotaColor = (percentage: number) => {
    const level = getQuotaLevel(percentage, settings.warningThreshold, settings.criticalThreshold);
    switch (level) {
      case QuotaLevel.Depleted:
        return { text: 'text-gray-400' };
      case QuotaLevel.Critical:
        return { text: 'text-red-400' };
      case QuotaLevel.Warning:
        return { text: 'text-yellow-400' };
      default:
        return { text: 'text-green-400' };
    }
  };

  const renderContent = () => {
    // Loading State
    if (isLoading && displayModels.length === 0) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping mr-2" />
          <span className="text-[10px] text-blue-200/70 font-medium tracking-widest uppercase">Initializing</span>
        </div>
      );
    }

    // Empty State
    if (displayModels.length === 0) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <BotIcon className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
          <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">No Model Selected</span>
        </div>
      );
    }

    // Default Models for Mockup logic
    // We try to detect based on ID/Alias to assign color/icon, or default to Left=Blue, Right=Orange
    const leftModel = displayModels[0];
    const rightModel = displayModels.length > 1 ? displayModels[1] : null;

    // Helper to determine icon based on model name/id
    const getModelIcon = (id: string, alias?: string) => {
      const key = (id + (alias || '')).toLowerCase();
      if (key.includes('claude')) return ClaudeIcon;
      if (key.includes('gemini') || key.includes('google')) return GeminiIcon;
      return BotIcon;
    };

    const LeftIcon = getModelIcon(leftModel.modelId, leftModel.alias);
    const RightIcon = rightModel ? getModelIcon(rightModel.modelId, rightModel.alias) : BotIcon;
    
    const leftColor = getQuotaColor(leftModel.remainingPercentage);
    const rightColor = rightModel ? getQuotaColor(rightModel.remainingPercentage) : null;

    return (
      <>
        {/* Left Section */}
        <div className="relative flex-1 h-full flex flex-col items-center justify-center overflow-hidden">
          {/* 水箱效果 */}
          <WaterTank percentage={leftModel.remainingPercentage} color="blue" />
          
          {/* 内容层 */}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <LeftIcon className="w-4 h-4 text-blue-200" />
              <span className="text-[12px] font-bold tracking-wider text-white/90 font-sans uppercase">
                {leftModel.alias || leftModel.displayName}
              </span>
            </div>
            <div className="relative">
              <span className={`text-3xl font-bold font-mono tracking-tighter ${leftColor.text} transition-colors duration-300`}>
                {Math.round(leftModel.remainingPercentage)}%
              </span>
            </div>
            {/* Reset Time */}
            {settings.showResetTimeInWidget && formatResetTimeSimple(leftModel.resetTime) && (
              <span className="text-xs text-white/60 font-semibold tracking-wide">
                ↻ {formatResetTimeSimple(leftModel.resetTime)}
              </span>
            )}
          </div>
        </div>

        {/* Right Section - 只在双模型时显示 */}
        {rightModel && rightColor && (
          <div className="relative flex-1 h-full flex flex-col items-center justify-center overflow-hidden">
            {/* 水箱效果 */}
            <WaterTank percentage={rightModel.remainingPercentage} color="orange" />
            
            {/* 内容层 */}
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <RightIcon className="w-4 h-4 text-orange-200" />
                <span className="text-[12px] font-bold tracking-wider text-white/90 font-sans uppercase">
                  {rightModel.alias || rightModel.displayName}
                </span>
              </div>
              <div className="relative">
                <span className={`text-3xl font-bold font-mono tracking-tighter ${rightColor.text} transition-colors duration-300`}>
                  {Math.round(rightModel.remainingPercentage)}%
                </span>
              </div>
              {/* Reset Time */}
              {settings.showResetTimeInWidget && formatResetTimeSimple(rightModel.resetTime) && (
                <span className="text-xs text-white/60 font-semibold tracking-wide">
                  ↻ {formatResetTimeSimple(rightModel.resetTime)}
                </span>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-transparent overflow-hidden">
      {/* 
        The Main Capsule Container 
        Structure:
        1. Outer Glow (Atmosphere)
        2. Border Ring (Metal/Glass edge)
        3. Body (Dark Glass)
        4. Inner Reflection (Top gloss)
      */}
      <div
        className="drag-region relative group cursor-default transition-all duration-500 hover:scale-[1.02]"
        style={{ transform: `scale(${settings.widgetScale || 1})` }}
      >

        {/* 1. Global Atmosphere Glow (Behind) */}
        <div className="absolute -inset-8 bg-gradient-to-r from-blue-600/30 via-purple-500/10 to-orange-600/30 rounded-[60px] blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-700" />

        {/* 2. The Glass Capsule Wrapper */}
        <div className={`relative h-[86px] rounded-[44px] p-[1px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] transition-all duration-300 ${displayModels.length > 1 ? 'w-[280px] bg-gradient-to-r from-blue-400/30 via-white/20 to-orange-400/30' : 'w-[150px] bg-gradient-to-r from-blue-400/30 to-blue-400/10'}`}>

          {/* 3. Inner Body Background */}
          <div className="relative w-full h-full bg-[#0a0a0a]/80 backdrop-blur-2xl rounded-[43px] flex items-center overflow-hidden border border-white/5">

            {/* Background Gradients (Subtle internal lighting) */}
            <div className="absolute top-0 left-0 w-3/5 h-full bg-gradient-to-r from-blue-600/10 via-blue-900/5 to-transparent mix-blend-screen" />
            <div className="absolute top-0 right-0 w-3/5 h-full bg-gradient-to-l from-orange-600/10 via-orange-900/5 to-transparent mix-blend-screen" />

            {/* Content Container */}
            <div className="absolute inset-0 w-full h-full flex items-center">
              {renderContent()}
            </div>

            {/* 4. Top Gloss Reflection (The "Glass" Feel) */}
            <div className="absolute top-0 inset-x-0 h-[40%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[43px]" />

            {/* 5. Bottom Rim Light */}
            <div className="absolute bottom-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-blue-400/40 to-transparent blur-[1px]" />
            <div className="absolute bottom-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-orange-400/40 to-transparent blur-[1px] translate-x-12" />
          </div>
        </div>

        {/* Label: Binary Capsule (Bottom) */}
        <div className="absolute -bottom-8 left-0 right-0 text-center transition-opacity duration-300 opacity-0 group-hover:opacity-100 pointer-events-none">
          <span className="text-[9px] font-medium tracking-[0.3em] uppercase text-white/40 text-shadow-sm">
            AG Quota Watcher
          </span>
        </div>
      </div>
    </div>
  );
};

export default Widget;
