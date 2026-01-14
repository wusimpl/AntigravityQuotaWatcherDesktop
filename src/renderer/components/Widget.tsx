/**
 * 悬浮窗组件 - 双生能量胶囊 (Binary Energy Capsule)
 * 高保真还原设计图：玻璃拟态、冷暖对撞、3D质感、水箱效果
 */
import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SETTINGS, getQuotaLevel, QuotaLevel } from '../../shared/types';
import type { QuotaSnapshot, AppSettings, ModelConfig, SelectedModel, AccountModelConfigs } from '../../shared/types';
import { useI18nContext } from '../i18n/I18nContext';
import './Widget.css';

// Kiro 配额快照类型
interface KiroQuotaSnapshot {
  timestamp: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
}

// 用于显示的模型数据（包含配额和配置）
interface DisplayModel {
  accountId: string;
  modelId: string;
  displayName: string;
  alias: string;
  remainingPercentage: number;
  resetTime?: string;
  // Kiro Credits 特有字段
  isKiroCredits?: boolean;
  creditsRemaining?: number;
  creditsLimit?: number;
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

// 检测是否为 macOS 平台
const isMac = window.electronAPI?.getPlatform?.() === 'darwin';

const Widget: React.FC = () => {
  const { t } = useI18nContext();
  // 悬浮窗使用 showWidget: true 覆盖默认值
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS, showWidget: true });
  const [accountModelConfigs, setAccountModelConfigs] = useState<AccountModelConfigs>({});
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [allQuotas, setAllQuotas] = useState<Record<string, QuotaSnapshot>>({});
  const [kiroQuota, setKiroQuota] = useState<KiroQuotaSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [settingsData, quotas, kiroQuotaData] = await Promise.all([
        window.electronAPI?.getSettings(),
        window.electronAPI?.getAllQuotas(),
        window.electronAPI?.getKiroQuota?.(),
      ]);

      if (settingsData) {
        setSettings(settingsData.settings);
        setAccountModelConfigs(settingsData.accountModelConfigs || {});
        setSelectedModels(settingsData.selectedModels || []);
      }
      if (quotas) {
        setAllQuotas(quotas);
      }
      if (kiroQuotaData) {
        setKiroQuota(kiroQuotaData);
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

  // 监听 Kiro 配额更新
  useEffect(() => {
    const handleKiroQuotaUpdate = (snapshot: KiroQuotaSnapshot) => {
      setKiroQuota(snapshot);
    };

    const unsubscribe = window.electronAPI?.onKiroQuotaUpdate?.(handleKiroQuotaUpdate);

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

    // 首先添加选中的普通模型
    for (const selected of selectedModels) {
      // 检查是否为 Kiro Credits 特殊模型
      if (selected.modelId === 'kiro-credits' && kiroQuota) {
        models.push({
          accountId: 'kiro',
          modelId: 'kiro-credits',
          displayName: 'Kiro Credit',
          alias: 'Kiro Credit',
          remainingPercentage: kiroQuota.percentage,
          isKiroCredits: true,
          creditsRemaining: kiroQuota.remaining,
          creditsLimit: kiroQuota.limit,
        });
        if (models.length >= MAX_VISIBLE_MODELS) break;
        continue;
      }

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

  // 让 Electron 窗口大小随胶囊和缩放比例自适应，避免 >100% 时被裁切
  useEffect(() => {
    const scale = typeof settings.widgetScale === 'number' && Number.isFinite(settings.widgetScale)
      ? settings.widgetScale
      : 1;
    const baseWidth = displayModels.length > 1 ? 280 : 150;
    const baseHeight = 86;
    const safety = 80; // 与 main/window.ts 中的 WIDGET_SAFETY_MARGIN_PX 保持一致

    const width = Math.max(1, Math.ceil(baseWidth * scale) + safety);
    const height = Math.max(1, Math.ceil(baseHeight * scale) + safety);

    const rafId = window.requestAnimationFrame(() => {
      window.electronAPI?.setWidgetSize?.({ width, height });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [settings.widgetScale, displayModels.length]);

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

  // [修改] 水箱波浪组件 - 旋转圆形波浪版
  const WaterTank = ({ percentage, color, waveSpeed = 5, waveHeight = 3 }: { percentage: number; color: 'blue' | 'orange'; waveSpeed?: number; waveHeight?: number }) => {
    // 1. 计算水位 (Top)
    // 液位逻辑：0% 为 100% (底部空)，100% 对应 0% (顶部满)
    let topValue = 100 - percentage;
    // 边缘修正：胶囊形状需要额外调整以覆盖所有角落
    if (percentage > 92) {
      topValue -= 15; // 满额时多溢出一点
    } else if (percentage < 8) {
      topValue += 8; // 底部留白修正
    }

    // 2. 计算速度
    // waveSpeed: 0-10
    // speed=0 -> 静止
    // speed=10 -> 周期 1.5s (快)
    // speed=1 -> 周期 12s (慢)
    const speed = Math.max(0, Math.min(10, waveSpeed ?? 5));
    const isStill = speed === 0;
    // 速度映射：1(12s) 到 10(1.5s)
    const durationSec = speed === 0 ? 0 : (13.5 - speed * 1.2);

    // 3. 计算波形高度 (waveRadius)
    // waveHeight: 1-5
    // border-radius 越小，波浪起伏越大；越大，越平滑
    // 1 -> 50% (微波/平滑), 2 -> 44%, 3 -> 38% (默认), 4 -> 31%, 5 -> 25% (巨浪/尖锐)
    const heightLevel = Math.max(1, Math.min(5, waveHeight ?? 3));
    const waveRadiusValue = 50 - (heightLevel - 1) * 6.25;
    // 波浪圆角：静止时为0%（平面），运动时根据高度级别设置
    const waveRadius = isStill ? '0%' : `${waveRadiusValue}%`;

    return (
      <div
        className={`water-tank ${color} ${isStill ? 'still' : ''}`}
        style={{
          '--wave-speed': `${durationSec}s`,
          '--wave-radius': waveRadius,
        } as React.CSSProperties}
      >
        {/* 容器结构：
            - wave-group: 负责 Y 轴升降 (水位)
            - wave-layer: 旋转的大圆形，模拟波浪晃动
        */}
        <div className="wave-group" style={{ top: `${topValue}%` }}>
          {/* 后浪 */}
          <div
            className="wave-layer wave-back"
            style={{
              animationDuration: isStill ? '0s' : `${durationSec * 1.5}s`,
              animationPlayState: isStill ? 'paused' : 'running',
            }}
          />
          {/* 前浪 */}
          <div
            className="wave-layer wave-front"
            style={{
              animationDuration: isStill ? '0s' : `${durationSec}s`,
              animationPlayState: isStill ? 'paused' : 'running',
            }}
          />
        </div>
      </div>
    );
  };

  // 根据配额百分比获取颜色样式
  const getQuotaColor = (percentage: number) => {
    const level = getQuotaLevel(percentage, settings.warningThreshold, settings.criticalThreshold);
    switch (level) {
      case QuotaLevel.Depleted:
        return { text: 'text-quota-depleted' };
      case QuotaLevel.Critical:
        return { text: 'text-quota-critical' };
      case QuotaLevel.Warning:
        return { text: 'text-quota-warning' };
      default:
        return { text: 'text-quota-normal' };
    }
  };

  const renderContent = () => {
    // Loading State
    if (isLoading && displayModels.length === 0) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping mr-2" />
          <span className={`text-[10px] text-blue-200/70 tracking-widest uppercase ${isMac ? 'font-semibold' : 'font-medium'}`}>{t.widget.initializing}</span>
        </div>
      );
    }

    // Empty State
    if (displayModels.length === 0) {
      return (
        <div className="flex items-center justify-center w-full h-full">
          <BotIcon className="w-3.5 h-3.5 text-gray-400 mr-1.5" />
          <span className={`text-[10px] text-gray-400 tracking-wider uppercase ${isMac ? 'font-semibold' : 'font-medium'}`}>{t.widget.noModelSelected}</span>
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
      if (key.includes('kiro')) return BotIcon; // Kiro 使用通用图标
      if (key.includes('claude')) return ClaudeIcon;
      if (key.includes('gemini') || key.includes('google')) return GeminiIcon;
      return BotIcon;
    };

    const LeftIcon = getModelIcon(leftModel.modelId, leftModel.alias);
    const RightIcon = rightModel ? getModelIcon(rightModel.modelId, rightModel.alias) : BotIcon;

    const leftColor = getQuotaColor(leftModel.remainingPercentage);
    const rightColor = rightModel ? getQuotaColor(rightModel.remainingPercentage) : null;

    // 渲染配额显示文本（支持 Kiro Credits 格式）
    const renderQuotaText = (model: DisplayModel, colorClass: string) => {
      if (model.isKiroCredits && model.creditsRemaining !== undefined) {
        // Kiro Credits 显示格式: 只显示剩余额度
        return (
          <span className={`text-3xl font-bold font-mono tracking-tighter ${colorClass} transition-colors duration-300`}>
            {model.creditsRemaining}
          </span>
        );
      }
      // 普通模型显示百分比
      return (
        <span className={`text-3xl font-bold font-mono tracking-tighter ${colorClass} transition-colors duration-300`}>
          {Math.round(model.remainingPercentage)}%
        </span>
      );
    };

    return (
      <>
        {/* Left Section */}
        <div className={`relative flex-1 h-full flex flex-col items-center justify-center overflow-hidden ${rightModel ? 'rounded-l-[43px] rounded-r-[0px]' : 'rounded-[43px]'}`}>
          {/* 水箱效果 */}
          <WaterTank percentage={leftModel.remainingPercentage} color="blue" waveSpeed={settings.waveSpeed ?? 5} waveHeight={settings.waveHeight ?? 3} />

          {/* 内容层 */}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            {(settings.showModelNameInWidget ?? true) && (
              <div className="flex items-center gap-1.5 mb-0.5">
                <LeftIcon className="w-4 h-4 text-blue-200" />
<span className={`text-[12px] tracking-wider text-white/90 font-sans uppercase ${isMac ? 'font-extrabold' : 'font-bold'}`}>
                  {leftModel.alias || leftModel.displayName}
                </span>
              </div>
            )}
            {(settings.showPercentageInWidget ?? true) && (
              <div className="relative">
                {renderQuotaText(leftModel, leftColor.text)}
              </div>
            )}
            {/* Reset Time - Kiro Credits 显示固定的 monthly */}
            {settings.showResetTimeInWidget && (
              leftModel.isKiroCredits ? (
                <span className="text-xs text-white/60 font-semibold tracking-wide">
                  ↻ Monthly
                </span>
              ) : formatResetTimeSimple(leftModel.resetTime) ? (
                <span className="text-xs text-white/60 font-semibold tracking-wide">
                  ↻ {formatResetTimeSimple(leftModel.resetTime)}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* Right Section - 只在双模型时显示 */}
        {rightModel && rightColor && (
          <div className="relative flex-1 h-full flex flex-col items-center justify-center overflow-hidden rounded-r-[43px] rounded-l-[0px]">
            {/* 水箱效果 */}
            <WaterTank percentage={rightModel.remainingPercentage} color="orange" waveSpeed={settings.waveSpeed ?? 5} waveHeight={settings.waveHeight ?? 3} />

            {/* 内容层 */}
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              {(settings.showModelNameInWidget ?? true) && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <RightIcon className="w-4 h-4 text-orange-200" />
<span className={`text-[12px] tracking-wider text-white/90 font-sans uppercase ${isMac ? 'font-extrabold' : 'font-bold'}`}>
                    {rightModel.alias || rightModel.displayName}
                  </span>
                </div>
              )}
              {(settings.showPercentageInWidget ?? true) && (
                <div className="relative">
                  {renderQuotaText(rightModel, rightColor.text)}
                </div>
              )}
              {/* Reset Time - Kiro Credits 显示固定的 monthly */}
              {settings.showResetTimeInWidget && (
                rightModel.isKiroCredits ? (
                  <span className="text-xs text-white/60 font-semibold tracking-wide">
                    ↻ Monthly
                  </span>
                ) : formatResetTimeSimple(rightModel.resetTime) ? (
                  <span className="text-xs text-white/60 font-semibold tracking-wide">
                    ↻ {formatResetTimeSimple(rightModel.resetTime)}
                  </span>
                ) : null
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-transparent">
      {/* 
        The Main Capsule Container 
        Structure:
        1. Outer Glow (Atmosphere)
        2. Border Ring (Metal/Glass edge)
        3. Body (Dark Glass)
        4. Inner Reflection (Top gloss)
      */}
      <div
        className="drag-region relative cursor-default"
        style={
          (settings.widgetScale ?? 1) === 1
            ? undefined
            : ({ zoom: settings.widgetScale ?? 1 } as React.CSSProperties)
        }
      >

        {/* 1. Global Atmosphere Glow - 已移除，避免透明窗口下出现矩形背景 */}

        {/* 2. The Glass Capsule Wrapper */}
        <div className={`relative h-[86px] rounded-[44px] p-[1px] transition-all duration-300 ${displayModels.length > 1 ? 'w-[280px] bg-gradient-to-r from-blue-400/30 via-white/20 to-orange-400/30' : 'w-[150px] bg-gradient-to-r from-blue-400/30 to-blue-400/10'}`}>

          {/* 3. Inner Body Background */}
          <div className="relative w-full h-full bg-[#0a0a0a]/80 rounded-[43px] flex items-center overflow-hidden border border-white/5">

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
        <div className="absolute -bottom-8 left-0 right-0 text-center opacity-0 pointer-events-none">
<span className={`text-[9px] tracking-[0.3em] uppercase text-white/40 text-shadow-sm ${isMac ? 'font-semibold' : 'font-medium'}`}>
            {t.widget.appName}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Widget;
