/**
 * 数据存储模块
 * 使用 electron-store 进行本地数据持久化
 */
import Store from 'electron-store';

// 配置类型定义
interface StoreSchema {
  // 悬浮窗位置
  widgetBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 应用设置
  settings: {
    pollingInterval: number;    // 刷新间隔（秒）
    warningThreshold: number;   // 警告阈值（%）
    criticalThreshold: number;  // 紧急阈值（%）
    autoStart: boolean;         // 开机自启
    notifications: boolean;     // 系统通知
    showWidget: boolean;        // 显示悬浮窗
    language: 'auto' | 'zh-CN' | 'en';
  };
  // 模型配置
  modelConfigs: Record<string, {
    visible: boolean;
    alias: string;
    order: number;
  }>;
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
    language: 'auto',
  },
  modelConfigs: {},
};

export const store = new Store<StoreSchema>({
  name: 'config',
  defaults,
});
