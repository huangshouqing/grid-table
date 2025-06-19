// 导入样式
import './style/index.css';

// 导入Grid类
import { Grid } from './grid';

// 导出主要的 Grid 类
export { Grid } from './grid';

// 创建一个便捷函数，保持向后兼容性
export function createGrid(options: any) {
  return new Grid(options);
}

// 导出类型定义
export * from './types';

// 导出管理器类
export * from './managers/ComponentManager';
export * from './eventbus/EventBus';
export * from './managers/GridEventBusHandler';
export * from './managers/VirtualDOMManager';