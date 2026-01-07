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
  language: 'auto' | 'zh-CN' | 'en';
}

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
