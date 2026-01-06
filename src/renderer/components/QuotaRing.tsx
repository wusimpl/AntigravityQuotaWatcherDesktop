import React from 'react';
import { QuotaLevel, getQuotaLevel } from '../../shared/types';

interface QuotaRingProps {
  percentage: number;
  label: string;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: number;
}

// 配额等级对应的颜色
const levelColors: Record<QuotaLevel, string> = {
  [QuotaLevel.Normal]: '#22c55e',    // 绿色
  [QuotaLevel.Warning]: '#eab308',   // 黄色
  [QuotaLevel.Critical]: '#ef4444',  // 红色
  [QuotaLevel.Depleted]: '#6b7280',  // 灰色
};

const QuotaRing: React.FC<QuotaRingProps> = ({
  percentage,
  label,
  warningThreshold = 50,
  criticalThreshold = 30,
  size = 64,
}) => {
  const level = getQuotaLevel(percentage, warningThreshold, criticalThreshold);
  const color = levelColors[level];
  
  // SVG 圆环参数
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 圆环 */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* 背景圆环 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
          />
          {/* 进度圆环 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="quota-ring transition-all duration-500"
          />
        </svg>
        {/* 百分比文字 */}
        <div 
          className="absolute inset-0 flex items-center justify-center text-white font-medium"
          style={{ fontSize: size * 0.22 }}
        >
          {Math.round(percentage)}%
        </div>
      </div>
      
      {/* 标签 */}
      <span className="text-xs text-gray-400 truncate max-w-[80px]" title={label}>
        {label}
      </span>
    </div>
  );
};

export default QuotaRing;
