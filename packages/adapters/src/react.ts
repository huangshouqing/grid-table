// 导出React相关适配器
export * from './react/ReactAdapter';

// 导出基础类型
export * from './types';
export * from './BaseAdapter';

// React特定的工厂函数
import { ReactAdapter } from './react/ReactAdapter';

/**
 * 创建React适配器实例
 */
export function createReactAdapter() {
  return new ReactAdapter();
} 