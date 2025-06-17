// 导出类型定义
export * from './types';

// 导出基础适配器
export * from './BaseAdapter';

// 导出React适配器
export * from './react/ReactAdapter';

// 导出Vue适配器
export * from './vue/VueAdapter';

// 导出Angular适配器
export * from './angular/AngularAdapter';

// 导出一个便捷的适配器工厂函数
import { ReactAdapter } from './react/ReactAdapter';
import { VueAdapter } from './vue/VueAdapter';
import { createAngularAdapter } from './angular/AngularAdapter';
import { IFrameworkAdapter } from './types';

/**
 * 创建适配器实例
 * @param framework 框架名称
 * @param dependencies 框架特定的依赖
 */
export function createAdapter(
  framework: 'react' | 'vue' | 'angular',
  dependencies?: any
): IFrameworkAdapter {
  switch (framework) {
    case 'react':
      return new ReactAdapter();
    case 'vue':
      return new VueAdapter();
    case 'angular':
      if (!dependencies || !dependencies.ngZone || !dependencies.applicationRef) {
        throw new Error('Angular adapter requires ngZone and applicationRef dependencies');
      }
      return createAngularAdapter(dependencies.ngZone, dependencies.applicationRef);
    default:
      throw new Error(`Unsupported framework: ${framework}`);
  }
} 