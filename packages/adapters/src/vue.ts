// 导出Vue相关适配器
export * from './vue/VueAdapter';
export * from './vue/VueComponentWrapper';

// 导出基础类型
export * from './types';
export * from './BaseAdapter';

// Vue特定的工厂函数
import { VueAdapter } from './vue/VueAdapter';

/**
 * 创建Vue适配器实例
 */
export function createVueAdapter() {
  return new VueAdapter();
} 