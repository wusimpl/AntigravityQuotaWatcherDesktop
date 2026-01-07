/**
 * 数据存储模块
 * 使用 electron-store 进行本地数据持久化
 */
import Store from 'electron-store';
import type { AppSettings, ModelConfig, SelectedModel, AccountModelConfigs } from '../shared/types';

// 配置类型定义
export interface StoreSchema {
  // 悬浮窗位置
  widgetBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 应用设置 - 使用共享类型确保一致性
  settings: AppSettings;
  // 模型配置（旧版，保留兼容）
  modelConfigs: Record<string, ModelConfig>;
  // 账户模型配置（新版：accountId -> modelId -> ModelConfig）
  accountModelConfigs: AccountModelConfigs;
  // 选中的模型（最多2个，用于悬浮窗显示）
  selectedModels: SelectedModel[];
}

// 默认配置
const defaults: StoreSchema = {
  settings: {
    pollingInterval: 60,
    warningThreshold: 50,
    criticalThreshold: 30,
    autoStart: false,
    notifications: true,
    showWidget: false,  // 默认不显示悬浮窗
    widgetScale: 1,     // 默认缩放比例
    language: 'auto',
  },
  modelConfigs: {},
  accountModelConfigs: {},
  selectedModels: [],
};

export const store = new Store<StoreSchema>({
  name: 'config',
  defaults,
});
