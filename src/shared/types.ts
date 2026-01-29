/**
 * 共享类型定义
 */

// 模型配额信息
export interface ModelQuotaInfo {
  modelId: string;           // 模型 ID (如 "gemini-2.5-pro")
  displayName: string;       // 显示名称 (如 "Gemini 2.5 Pro")
  alias?: string;            // 用户自定义别名
  remainingFraction: number; // 剩余配额比例 (0-1)
  remainingPercentage: number; // 剩余百分比 (0-100)
  isExhausted: boolean;      // 是否耗尽
  resetTime: string;         // 重置时间 (ISO 8601)
  // Kiro Credits 特有字段
  isKiroCredits?: boolean;   // 是否为 Kiro Credits 类型
  creditsUsed?: number;      // 已使用的 credits
  creditsLimit?: number;     // credits 总量
  creditsRemaining?: number; // 剩余 credits
}

// 配额快照
export interface QuotaSnapshot {
  timestamp: string;
  models: ModelQuotaInfo[];
  userEmail?: string;
  tier?: string;
}

// 账户信息
export interface AccountInfo {
  id: string;
  email: string;
  isActive: boolean;
}

// 应用设置
export interface AppSettings {
  pollingInterval: number;    // 刷新间隔（秒）
  warningThreshold: number;   // 警告阈值（%）
  criticalThreshold: number;  // 紧急阈值（%）
  autoStart: boolean;         // 开机自启
  notifications: boolean;     // 系统通知
  showWidget: boolean;        // 显示悬浮窗
  widgetScale: number;        // 悬浮窗缩放比例 (0.5-1.5)
  waveSpeed: number;          // 水波速度 (0-10, 0=静止)
  waveHeight: number;         // 波形高度 (1-5, 1=小波浪, 5=大波浪)
  showResetTimeInWidget: boolean; // 在悬浮窗显示重置时间
  showModelNameInWidget: boolean; // 在悬浮窗显示模型名称
  showPercentageInWidget: boolean; // 在悬浮窗显示剩余额度百分比
  miniBarTextColor: 'white' | 'black'; // 迷你指示条文字颜色
  language: 'auto' | 'zh-CN' | 'en';
  proxyEnabled: boolean;            // 是否启用代理
  proxyUrl: string;                 // 代理 URL（空字符串表示使用系统代理）
}

// 默认设置值（唯一定义，所有地方引用此常量）
export const DEFAULT_SETTINGS: AppSettings = {
  pollingInterval: 60,
  warningThreshold: 50,
  criticalThreshold: 30,
  autoStart: false,
  notifications: true,
  showWidget: false,
  widgetScale: 0.8,       // 悬浮窗默认大小 80%
  waveSpeed: 1,           // 水波速度默认缓慢
  waveHeight: 3,          // 波形高度默认中等
  showResetTimeInWidget: true,
  showModelNameInWidget: true,
  showPercentageInWidget: true,
  miniBarTextColor: 'white',    // 迷你指示条文字颜色默认白色
  language: 'auto',
  proxyEnabled: false,
  proxyUrl: '',
};

// 模型配置
export interface ModelConfig {
  visible: boolean;
  alias: string;
  order: number;
}

// 选中的模型（用于悬浮窗显示）
export interface SelectedModel {
  accountId: string;
  modelId: string;
}

// 账户模型配置（每个账户独立的模型配置）
export type AccountModelConfigs = Record<string, Record<string, ModelConfig>>;

// 配额等级
export enum QuotaLevel {
  Normal = 'normal',     // > warningThreshold
  Warning = 'warning',   // criticalThreshold ~ warningThreshold
  Critical = 'critical', // 0 ~ criticalThreshold
  Depleted = 'depleted', // = 0
}

// 获取配额等级
export function getQuotaLevel(
  percentage: number,
  warningThreshold: number,
  criticalThreshold: number
): QuotaLevel {
  if (percentage <= 0) return QuotaLevel.Depleted;
  if (percentage < criticalThreshold) return QuotaLevel.Critical;
  if (percentage < warningThreshold) return QuotaLevel.Warning;
  return QuotaLevel.Normal;
}
