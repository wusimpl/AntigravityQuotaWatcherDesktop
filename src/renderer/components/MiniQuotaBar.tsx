/**
 * MiniQuotaBar - 迷你配额指示条组件
 * 用于在悬浮窗底部显示次级模型的简化状态
 */
import React from 'react';
import { getQuotaLevel, QuotaLevel } from '../../shared/types';
import type { AppSettings } from '../../shared/types';
import { useI18nContext } from '../i18n/I18nContext';

// 用于显示的模型数据（与 Widget.tsx 中的 DisplayModel 保持一致）
export interface DisplayModel {
  accountId: string;
  modelId: string;
  displayName: string;
  alias: string;
  remainingPercentage: number;
  resetTime?: string;
  isKiroCredits?: boolean;
  creditsRemaining?: number;
  creditsLimit?: number;
}

interface MiniQuotaBarProps {
  models: DisplayModel[];
  settings: AppSettings;
  onModelClick: (model: DisplayModel, index: number) => void;
  position?: 'top' | 'bottom'; // 位置：上方或下方
}

// 根据配额百分比获取进度条颜色
const getProgressColor = (
  percentage: number,
  warningThreshold: number,
  criticalThreshold: number
): string => {
  const level = getQuotaLevel(percentage, warningThreshold, criticalThreshold);
  switch (level) {
    case QuotaLevel.Depleted:
      return 'bg-gray-500';
    case QuotaLevel.Critical:
      return 'bg-red-500';
    case QuotaLevel.Warning:
      return 'bg-yellow-500';
    default:
      return 'bg-green-500';
  }
};

// 检测是否为 macOS 平台
const isMac = window.electronAPI?.getPlatform?.() === 'darwin';

const MiniQuotaBar: React.FC<MiniQuotaBarProps> = ({ models, settings, onModelClick, position = 'bottom' }) => {
  const { t } = useI18nContext();

  if (models.length === 0) {
    return null;
  }

  // 根据位置添加不同的样式类
  const positionClass = position === 'top' ? 'mini-quota-bar-top' : 'mini-quota-bar-bottom';

  return (
    <div className={`mini-quota-bar ${positionClass}`}>
      {models.map((model, index) => {
        const progressColor = getProgressColor(
          model.remainingPercentage,
          settings.warningThreshold,
          settings.criticalThreshold
        );

        // 显示值：Kiro Credits 显示剩余数量，其他显示百分比
        const displayValue = model.isKiroCredits && model.creditsRemaining !== undefined
          ? model.creditsRemaining.toString()
          : `${Math.round(model.remainingPercentage)}%`;

        // 截断别名，最多显示 6 个字符
        const shortAlias = (model.alias || model.displayName).slice(0, 6);

        return (
          <div
            key={`${model.accountId}-${model.modelId}`}
            className="mini-quota-item"
            onClick={() => onModelClick(model, index)}
            title={t.widget.clickToSwitch}
          >
            {/* 进度条 */}
            <div className="mini-progress-bar">
              <div
                className={`mini-progress-fill ${progressColor}`}
                style={{ width: `${Math.min(100, Math.max(0, model.remainingPercentage))}%` }}
              />
            </div>
            {/* 百分比/数值 */}
            <span className={`mini-quota-value ${isMac ? 'font-semibold' : 'font-medium'}`}>
              {displayValue}
            </span>
            {/* 别名 */}
            <span className={`mini-quota-alias ${isMac ? 'font-semibold' : 'font-medium'}`}>
              {shortAlias}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MiniQuotaBar;
